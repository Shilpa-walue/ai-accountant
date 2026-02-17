# Copyright (c) 2026, Shilparani and contributors
# For license information, please see license.txt

# import frappe
#from frappe.model.document import Document


#class DocumentUpload(Document):
#	pass



import frappe
from frappe.model.document import Document
import pdfplumber
import re
import os
from dateutil import parser as date_parser

os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

from paddleocr import PaddleOCR


class DocumentUpload(Document):
    pass


@frappe.whitelist()
def process_paddle_ocr(docname):
    doc = frappe.get_doc("Document Upload", docname)

    try:
        doc.status = "Processing"
        doc.save(ignore_permissions=True)

        # Get correct file path
        file_url = doc.upload_file
        site_path = frappe.get_site_path()

        if file_url.startswith("/private/files/"):
            file_path = os.path.join(site_path, file_url.lstrip("/"))
        elif file_url.startswith("/files/"):
            file_path = os.path.join(site_path, "public", file_url.lstrip("/"))
        else:
            file_doc = frappe.get_doc("File", {"file_url": file_url})
            file_path = file_doc.get_full_path()

        if not os.path.exists(file_path):
            raise Exception("File not found: " + file_path)

        extracted_text = ""
        rec_texts = []
        confidence_scores = []

        ext = file_path.split(".")[-1].lower()

        # Try PDF text extraction first
        if ext == "pdf":
            try:
                with pdfplumber.open(file_path) as pdf:
                    for page in pdf.pages:
                        text = page.extract_text()
                        if text:
                            extracted_text += text + "\n"
            except Exception:
                pass

        # If empty or image, use PaddleOCR
        if not extracted_text.strip():
            ocr = PaddleOCR(use_angle_cls=True, lang="en", enable_mkldnn=False)
            result = ocr.ocr(file_path)

            for r in result:
                texts = r.get("rec_texts", [])
                scores = r.get("rec_scores", [])
                rec_texts = list(texts)
                for text in texts:
                    extracted_text += text + "\n"
                confidence_scores.extend(scores)

        doc.extracted_text = extracted_text

        # Confidence
        if confidence_scores:
            avg_conf = sum(confidence_scores) / len(confidence_scores)
            doc.ocr_confidence = round(avg_conf * 100, 2)

        # Extract data
        if rec_texts:
            extract_from_tokens(doc, rec_texts)
        else:
            extract_from_text(doc, extracted_text)

        doc.status = "Extracted"
        doc.save(ignore_permissions=True)

        return {"success": True}

    except Exception as e:
        doc.status = "Failed"
        doc.save(ignore_permissions=True)
        frappe.log_error(str(e), "Paddle OCR Error")
        return {"success": False, "message": str(e)}


def clean_number(text):
    """Remove currency symbols and extract number"""
    # Remove ₹, $, ‡, Rs, INR and any non-numeric chars except . and ,
    cleaned = re.sub(r"[^\d.,]", "", text)
    cleaned = cleaned.replace(",", "")
    try:
        return float(cleaned) if cleaned else 0
    except Exception:
        return 0


def extract_from_tokens(doc, tokens):
    """Extract data from PaddleOCR tokens (for images/scanned docs)"""

    # --- VENDOR NAME ---
    # Combine first two tokens if both look like names
    if len(tokens) >= 2:
        t0 = tokens[0].strip()
        t1 = tokens[1].strip()
        if not re.search(r"(road|rd|layout|street|gst|service|no\.|#|\d{3,})", t1, re.IGNORECASE):
            doc.vendor_name = t0 + " " + t1
        else:
            doc.vendor_name = t0
    elif tokens:
        doc.vendor_name = tokens[0]

    # --- GSTIN ---
    for text in tokens:
        gst_match = re.search(r"\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d][A-Z\d]", text)
        if gst_match:
            doc.vendor_number = gst_match.group()
            break

    # --- INVOICE DATE ---
    invoice_date = None
    for i, text in enumerate(tokens):
        # Look for "Date: 16 May 2024" in same token
        date_match = re.search(
            r"\d{1,2}\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s*\d{2,4}",
            text, re.IGNORECASE
        )
        if date_match:
            try:
                parsed = date_parser.parse(date_match.group(), fuzzy=True)
                invoice_date = parsed.strftime("%Y-%m-%d")
                break
            except Exception:
                pass

        # Also try dd/mm/yyyy
        date_match2 = re.search(r"\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}", text)
        if date_match2:
            try:
                parsed = date_parser.parse(date_match2.group(), dayfirst=True)
                invoice_date = parsed.strftime("%Y-%m-%d")
                break
            except Exception:
                pass

    if invoice_date:
        doc.invoice_date = invoice_date

    # --- TOTAL AMOUNT ---
    # MUST have colon "Total:" — not just "Total" (which is the header)
    total_amount = 0
    for i, text in enumerate(tokens):
        clean_text = text.strip().lower()
        # Match "Total:" or "Grand Total:" but NOT "Sub-Total:"
        if clean_text in ("total:", "grand total:") or clean_text == "total":
            # Check if this token has a colon (actual total) vs no colon (header)
            if ":" in text:
                # Look at next tokens for the amount
                for j in range(i + 1, min(i + 3, len(tokens))):
                    num = clean_number(tokens[j])
                    if num > 0:
                        total_amount = num
                        break
                if total_amount:
                    break

    # If no "Total:" found, look for "Total" followed by a large number
    # but skip the header row
    if not total_amount:
        for i in range(len(tokens) - 1, -1, -1):
            if tokens[i].strip().lower() in ("total:", "total"):
                # Only use if it's near the end (not the header)
                if i > len(tokens) / 2:
                    for j in range(i + 1, min(i + 3, len(tokens))):
                        num = clean_number(tokens[j])
                        if num > 0:
                            total_amount = num
                            break
                    if total_amount:
                        break

    doc.total_amount = total_amount

    # --- LINE ITEMS ---
    doc.transactions = []

    # Find "Item" header position
    item_idx = -1
    for i, text in enumerate(tokens):
        if text.strip().lower() in ("item", "items", "description", "particulars"):
            item_idx = i
            break

    if item_idx >= 0:
        # Count header columns
        header_tokens = []
        header_keywords = ("item", "items", "description", "particulars", "price",
                           "rate", "qty", "quantity", "total", "amount", "sr", "no", "unit")

        for j in range(item_idx, min(item_idx + 6, len(tokens))):
            if tokens[j].strip().lower() in header_keywords:
                header_tokens.append(tokens[j].strip().lower())
            else:
                break

        header_count = len(header_tokens) if len(header_tokens) >= 2 else 4

        # Determine column positions
        has_price_col = "price" in header_tokens or "rate" in header_tokens
        has_qty_col = "qty" in header_tokens or "quantity" in header_tokens

        # Parse items
        i = item_idx + header_count

        while i + header_count <= len(tokens):
            token = tokens[i]

            # Stop at Sub-Total, CGST, Mode, etc.
            if re.search(r"(sub.?total|cgst|sgst|mode|total:|grand|save|time:|tax|discount)",
                         token, re.IGNORECASE):
                break

            item_name = token

            if header_count == 4 and has_price_col and has_qty_col:
                # Columns: Item, Price, Qty, Total
                price = clean_number(tokens[i + 1])
                qty = clean_number(tokens[i + 2])

                # Calculate Price x Qty (more reliable than OCR'd total)
                if price > 0 and qty > 0:
                    item_total = price * qty
                else:
                    # Fallback to last column
                    item_total = clean_number(tokens[i + 3])

                if item_name and item_total > 0:
                    doc.append("transactions", {
                        "description": item_name,
                        "date": invoice_date or "",
                        "debit": item_total,
                        "credit": 0,
                        "confidence": 85
                    })

            elif header_count >= 2:
                # Unknown column layout, use last number
                last_num = clean_number(tokens[i + header_count - 1])
                if item_name and last_num > 0:
                    doc.append("transactions", {
                        "description": item_name,
                        "date": invoice_date or "",
                        "debit": last_num,
                        "credit": 0,
                        "confidence": 75
                    })

            i += header_count

    # Fallback: single transaction with total
    if not doc.transactions and doc.total_amount:
        doc.append("transactions", {
            "description": "Bill from " + str(doc.vendor_name or "Unknown"),
            "date": invoice_date or "",
            "debit": doc.total_amount,
            "credit": 0,
            "confidence": 70
        })

    doc.status = "Extracted"


def extract_from_text(doc, extracted_text):
    """Extract data from plain text (for digital PDFs via pdfplumber)"""

    lines = extracted_text.split("\n")

    # Vendor
    for line in lines:
        clean = line.strip()
        if len(clean) > 3 and not re.search(r"(gst|invoice|tax|date|receipt)", clean, re.IGNORECASE):
            doc.vendor_name = clean
            break

    # GSTIN
    for line in lines:
        gst_match = re.search(r"\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d][A-Z\d]", line)
        if gst_match:
            doc.vendor_number = gst_match.group()
            break

    # Date
    invoice_date = None
    for line in lines:
        date_match = re.search(
            r"\d{1,2}\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s*\d{2,4}",
            line, re.IGNORECASE
        )
        if date_match:
            try:
                parsed = date_parser.parse(date_match.group(), fuzzy=True)
                invoice_date = parsed.strftime("%Y-%m-%d")
                doc.invoice_date = invoice_date
                break
            except Exception:
                pass

        date_match2 = re.search(r"\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}", line)
        if date_match2:
            try:
                parsed = date_parser.parse(date_match2.group(), dayfirst=True)
                invoice_date = parsed.strftime("%Y-%m-%d")
                doc.invoice_date = invoice_date
                break
            except Exception:
                pass

    # Total - look for "Total" keyword (not Sub-Total)
    total_amount = 0
    for line in lines:
        if re.search(r"(^|\s)total", line, re.IGNORECASE) and not re.search(r"sub.?total", line, re.IGNORECASE):
            nums = re.findall(r"[\d,]+\.?\d*", line)
            if nums:
                try:
                    total_amount = float(nums[-1].replace(",", ""))
                except Exception:
                    pass
                if total_amount:
                    break

    doc.total_amount = total_amount

    # Line items
    doc.transactions = []
    in_items = False

    for line in lines:
        clean = line.strip()

        if re.search(r"^(item|description|particulars)", clean, re.IGNORECASE):
            in_items = True
            continue

        if re.search(r"(sub.?total|cgst|sgst|total:|grand|tax)", clean, re.IGNORECASE):
            in_items = False
            continue

        if in_items and len(clean) > 2:
            parts = re.split(r"\s{2,}", clean)
            if len(parts) >= 4:
                item_name = parts[0]
                # Price x Qty
                nums = re.findall(r"[\d,]+\.?\d*", clean)
                if len(nums) >= 3:
                    try:
                        price = float(nums[0].replace(",", ""))
                        qty = float(nums[1].replace(",", ""))
                        amount = price * qty
                    except Exception:
                        amount = float(nums[-1].replace(",", "")) if nums else 0

                    doc.append("transactions", {
                        "description": item_name,
                        "date": invoice_date or "",
                        "debit": amount,
                        "credit": 0,
                        "confidence": 85
                    })
            elif len(parts) >= 2:
                item_name = parts[0]
                nums = re.findall(r"[\d,]+\.?\d*", clean)
                if nums:
                    try:
                        amount = float(nums[-1].replace(",", ""))
                        doc.append("transactions", {
                            "description": item_name,
                            "date": invoice_date or "",
                            "debit": amount,
                            "credit": 0,
                            "confidence": 80
                        })
                    except Exception:
                        pass

    # Fallback
    if not doc.transactions and doc.total_amount:
        doc.append("transactions", {
            "description": "Bill from " + str(doc.vendor_name or "Unknown"),
            "date": invoice_date or "",
            "debit": doc.total_amount,
            "credit": 0,
            "confidence": 70
        })
