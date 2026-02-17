# ai_accountant/api/ocr.py
# Built for ERPNext_Purchase_Invoice_PINV-2024-00145.pdf format

import frappe
import pdfplumber
import re
import os
import traceback
from dateutil import parser as date_parser

os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

from paddleocr import PaddleOCR


@frappe.whitelist()
def smart_scan(file_url):
    try:
        # ── Step 1: Resolve file path ────────────────────────────────────
        site_path = frappe.get_site_path()
        if file_url.startswith("/private/files/"):
            file_path = os.path.join(site_path, file_url.lstrip("/"))
        elif file_url.startswith("/files/"):
            file_path = os.path.join(site_path, "public", file_url.lstrip("/"))
        else:
            file_doc = frappe.get_doc("File", {"file_url": file_url})
            file_path = file_doc.get_full_path()

        if not os.path.exists(file_path):
            return {"success": False, "error": "File not found: " + file_path}

        # ── Step 2: Extract raw text ─────────────────────────────────────
        extracted_text = ""
        rec_texts      = []
        ext = file_path.split(".")[-1].lower()

        # Digital PDF → pdfplumber
        if ext == "pdf":
            try:
                with pdfplumber.open(file_path) as pdf:
                    for page in pdf.pages:
                        t = page.extract_text()
                        if t:
                            extracted_text += t + "\n"
            except Exception:
                pass

        # Scanned / image PDF → PaddleOCR fallback
        if not extracted_text.strip():
            ocr = PaddleOCR(use_angle_cls=True, lang="en", enable_mkldnn=False)
            result = ocr.ocr(file_path)
            for r in result:
                texts     = r.get("rec_texts", [])
                rec_texts = list(texts)
                for text in texts:
                    extracted_text += text + "\n"

        if not extracted_text.strip():
            return {"success": False, "error": "No text could be extracted from the file"}

        # ── Step 3: Parse everything ─────────────────────────────────────
        data = parse_invoice(extracted_text)

        # ── Step 4: Auto-create supplier if not exists ───────────────────
        supplier = data.get("supplier")
        if supplier and not frappe.db.exists("Supplier", supplier):
            try:
                sup = frappe.new_doc("Supplier")
                sup.supplier_name  = supplier
                sup.supplier_group = (
                    frappe.db.get_value("Supplier Group", {"is_group": 0}, "name")
                    or "All Supplier Groups"
                )
                sup.supplier_type  = "Company"
                if data.get("gstin"):
                    sup.tax_id = data["gstin"]
                sup.insert(ignore_permissions=True)
                frappe.db.commit()
            except Exception:
                pass

        # ── Step 5: Auto-create items that don't exist in Item master ────
        for item in data.get("items", []):
            item_code = item.get("item_code", "").strip()
            item_name = item.get("item_name", "").strip()
            if not item_code:
                continue
            if not frappe.db.exists("Item", item_code):
                try:
                    itm = frappe.new_doc("Item")
                    itm.item_code        = item_code
                    itm.item_name        = item_name or item_code
                    itm.description      = item_name or item_code
                    itm.item_group       = (
                        frappe.db.get_value("Item Group", {"is_group": 0}, "name")
                        or "All Item Groups"
                    )
                    itm.stock_uom        = item.get("uom", "Nos")
                    itm.is_purchase_item = 1
                    itm.is_stock_item    = 0   # non-stock = no warehouse required
                    itm.insert(ignore_permissions=True)
                    frappe.db.commit()
                except Exception:
                    pass

        # ── Step 6: Return all data ───────────────────────────────────────
        return {
            "success":      True,
            "supplier":     data.get("supplier"),
            "bill_no":      data.get("bill_no"),
            "bill_date":    data.get("bill_date"),
            "posting_date": data.get("posting_date"),
            "due_date":     data.get("due_date"),
            "gstin":        data.get("gstin"),
            "items":        data.get("items", []),
            "taxes":        data.get("taxes", []),
            "grand_total":  data.get("grand_total", 0),
        }

    except Exception as e:
        frappe.log_error(traceback.format_exc()[:130], "OCR error")
        return {"success": False, "error": str(e)[:200]}


# ── Core parser ───────────────────────────────────────────────────────────────

def clean_amount(text):
    """Remove n prefix, HTML tags, commas → float"""
    t = re.sub(r'<[^>]+>', '', str(text))   # strip <b> etc
    t = re.sub(r'[n₹\$,\s]', '', t)
    t = re.sub(r'[^\d.]', '', t)
    try:
        return float(t) if t else 0
    except Exception:
        return 0


def parse_invoice(text):
    data  = {
        "supplier": None, "gstin": None,
        "bill_no": None, "bill_date": None,
        "posting_date": None, "due_date": None,
        "items": [], "taxes": [], "grand_total": 0,
    }
    lines = text.split("\n")

    # ── Supplier ─────────────────────────────────────────────────────────
    # PDF is two-column: "Tech Solutions Pvt Ltd   Invoice No: PINV-..."
    # Only look in first 8 lines, strip right column by splitting on keyword
    for line in lines[:8]:
        l = line.strip()
        if not l: continue
        if re.search(r'(purchase invoice|supplier information|invoice details)', l, re.IGNORECASE): continue
        if re.search(r'^(gstin|phone|email)', l, re.IGNORECASE): continue

        left = re.split(
            r'\s+(?=Invoice\b|Supplier\b|Posting\b|Bill\b|Due\b|GSTIN|Phone|Email|Status)',
            l
        )[0].strip()

        if (left and len(left) > 3
                and re.search(r'[A-Za-z]{3,}', left)
                and not re.search(r'^\d|[@#]', left)):
            data["supplier"] = left
            break

    # ── Invoice number (not Supplier Invoice No) ──────────────────────────
    for line in lines:
        if re.search(r'supplier\s+invoice\s+no', line, re.IGNORECASE): continue
        m = re.search(r'invoice\s+no[.:\s]+([A-Z0-9\-/]+)', line, re.IGNORECASE)
        if m:
            data["bill_no"] = m.group(1).strip()
            break

    # ── Bill Date ────────────────────────────────────────────────────────
    for line in lines:
        if re.search(r'bill\s+date', line, re.IGNORECASE):
            m = re.search(r'\d{4}-\d{2}-\d{2}', line)
            if m: data["bill_date"] = m.group(); break
            m2 = re.search(r'\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}', line)
            if m2:
                try:
                    data["bill_date"] = date_parser.parse(m2.group(), dayfirst=True).strftime("%Y-%m-%d")
                    break
                except Exception: pass

    # ── Posting Date ─────────────────────────────────────────────────────
    for line in lines:
        if re.search(r'posting\s+date', line, re.IGNORECASE):
            m = re.search(r'\d{4}-\d{2}-\d{2}', line)
            if m: data["posting_date"] = m.group(); break

    # ── Due Date ──────────────────────────────────────────────────────────
    for line in lines:
        if re.search(r'due\s+date', line, re.IGNORECASE):
            m = re.search(r'\d{4}-\d{2}-\d{2}', line)
            if m: data["due_date"] = m.group(); break

    # ── Supplier GSTIN (first GSTIN in doc) ───────────────────────────────
    for line in lines:
        m = re.search(r'\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z0-9]{2}', line)
        if m: data["gstin"] = m.group(); break

    # ── Items ─────────────────────────────────────────────────────────────
    # Header row: "# Item Code  Item Name  Qty  UOM  Rate  Amount  Tax  Total"
    in_items = False
    for line in lines:
        l = line.strip()

        if re.search(r'^#\s+item\s+code\s+item\s+name', l, re.IGNORECASE):
            in_items = True
            continue

        if re.search(r'(tax\s+breakdown|subtotal|total\s+qty)', l, re.IGNORECASE):
            in_items = False
            continue

        if in_items and l:
            # Row format: "1  ITEM-CODE  Item Name Here  5  Nos  n65,000.00  n3,25,000.00  n58,500.00  n3,83,500.00"
            m = re.match(
                r'^(\d+)\s+(\S+)\s+(.+?)\s+(\d+)\s+(Nos|Kg|Box|Pcs|Units?|Ltr)\s+'
                r'(n[\d,]+\.\d+)\s+(n[\d,]+\.\d+)\s+(n[\d,]+\.\d+)\s+(n[\d,]+\.\d+)',
                l
            )
            if m:
                data["items"].append({
                    "item_code": m.group(2),
                    "item_name": m.group(3).strip(),
                    "qty":       float(m.group(4)),
                    "uom":       m.group(5),
                    "rate":      clean_amount(m.group(6)),
                    "amount":    clean_amount(m.group(7)),
                })

    # ── Taxes ─────────────────────────────────────────────────────────────
    # Header row: "Tax Type  Taxable Amount  Tax Rate  Tax Amount"
    in_tax = False
    for line in lines:
        l = line.strip()

        if re.search(r'tax\s+type\s+taxable', l, re.IGNORECASE):
            in_tax = True
            continue

        if re.search(r'<b>total\s+tax|^total\s+tax', l, re.IGNORECASE):
            in_tax = False
            continue

        if in_tax and l:
            m = re.match(r'(CGST|SGST|IGST)', l)
            if m:
                ttype = m.group(1)
                pct   = re.search(r'(\d+)%', l)
                nums  = re.findall(r'n([\d,]+\.\d+)', l)
                rate  = float(pct.group(1)) if pct else 0
                amt   = float(nums[-1].replace(',', '')) if nums else 0
                data["taxes"].append({"type": ttype, "rate": rate, "amount": amt})

    # ── Grand Total ───────────────────────────────────────────────────────
    for line in lines:
        l = re.sub(r'<[^>]+>', '', line)   # strip HTML bold tags
        if re.search(r'grand\s+total', l, re.IGNORECASE):
            nums = re.findall(r'n([\d,]+\.\d+)', line)
            if nums:
                data["grand_total"] = float(nums[-1].replace(',', ''))
                break

    return data
