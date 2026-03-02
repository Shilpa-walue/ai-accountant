# ai_accountant/api/batch_invoice_extractor.py
# Two-step bulk processing: extract_zip → review → create_invoices

import frappe
import json
import os
import zipfile
import tempfile
import traceback


# ══════════════════════════════════════════════════════════════════════════════
# Step 1: Extract & OCR — returns data for review, does NOT create invoices
# ══════════════════════════════════════════════════════════════════════════════

@frappe.whitelist()
def extract_zip(file_url):
    """
    Extract PDFs from ZIP, run OCR on each, return structured data for review.
    No invoices are created at this stage.
    """
    try:
        site_path = frappe.get_site_path()
        if file_url.startswith("/private/files/"):
            zip_path = os.path.join(site_path, file_url.lstrip("/"))
        elif file_url.startswith("/files/"):
            zip_path = os.path.join(site_path, "public", file_url.lstrip("/"))
        else:
            file_doc = frappe.get_doc("File", {"file_url": file_url})
            zip_path = file_doc.get_full_path()

        if not os.path.exists(zip_path):
            return {"success": False, "error": "ZIP file not found"}

        if not zipfile.is_zipfile(zip_path):
            return {"success": False, "error": "Not a valid ZIP file"}

        results = []

        with tempfile.TemporaryDirectory() as tmp_dir:
            with zipfile.ZipFile(zip_path, "r") as zf:
                pdf_names = [
                    name for name in zf.namelist()
                    if name.lower().endswith(".pdf")
                    and not name.startswith("__MACOSX")
                    and not os.path.basename(name).startswith(".")
                ]

                if not pdf_names:
                    return {"success": False, "error": "No PDF files found in ZIP"}

                if len(pdf_names) > 50:
                    return {"success": False, "error": f"Too many files ({len(pdf_names)}). Max 50."}

                for pdf_name in pdf_names:
                    filename = os.path.basename(pdf_name)
                    try:
                        zf.extract(pdf_name, tmp_dir)
                        extracted_path = os.path.join(tmp_dir, pdf_name)

                        # Upload to Frappe
                        with open(extracted_path, "rb") as f:
                            file_doc = frappe.get_doc({
                                "doctype": "File",
                                "file_name": filename,
                                "is_private": 1,
                                "folder": "Home/Attachments",
                                "content": f.read(),
                            })
                            file_doc.save(ignore_permissions=True)
                            frappe.db.commit()

                        # OCR via existing smart_scan
                        from ai_accountant.api.ocr import smart_scan
                        ocr_result = smart_scan(file_doc.file_url)

                        if not ocr_result or not ocr_result.get("success"):
                            results.append({
                                "filename": filename,
                                "file_url": file_doc.file_url,
                                "success": False,
                                "error": ocr_result.get("error", "OCR failed") if ocr_result else "No result",
                                "confidence": "failed",
                            })
                            continue

                        # Determine confidence
                        confidence = _calc_confidence(ocr_result)

                        results.append({
                            "filename": filename,
                            "file_url": file_doc.file_url,
                            "success": True,
                            "confidence": confidence,
                            "data": {
                                "supplier":     ocr_result.get("supplier"),
                                "bill_no":      ocr_result.get("bill_no"),
                                "bill_date":    ocr_result.get("bill_date"),
                                "posting_date": ocr_result.get("posting_date"),
                                "due_date":     ocr_result.get("due_date"),
                                "gstin":        ocr_result.get("gstin"),
                                "items":        ocr_result.get("items", []),
                                "taxes":        ocr_result.get("taxes", []),
                                "grand_total":  ocr_result.get("grand_total", 0),
                            },
                        })

                    except Exception as e:
                        results.append({
                            "filename": filename,
                            "file_url": "",
                            "success": False,
                            "error": str(e)[:200],
                            "confidence": "failed",
                        })

        return {"success": True, "results": results}

    except Exception as e:
        frappe.log_error(traceback.format_exc()[:500], "Batch ZIP Extract Error")
        return {"success": False, "error": str(e)[:300]}


def _calc_confidence(ocr_result):
    """Rate extraction confidence: high / medium / low."""
    score = 0
    if ocr_result.get("supplier"):     score += 2
    if ocr_result.get("bill_no"):      score += 2
    if ocr_result.get("bill_date"):    score += 1
    if ocr_result.get("posting_date"): score += 1
    if ocr_result.get("items"):        score += 2
    if ocr_result.get("grand_total"):  score += 2
    # max = 10
    if score >= 8:
        return "high"
    elif score >= 5:
        return "medium"
    return "low"


# ══════════════════════════════════════════════════════════════════════════════
# Step 2a: Create a SINGLE invoice (called one-by-one from JS for live progress)
# ══════════════════════════════════════════════════════════════════════════════

@frappe.whitelist()
def create_single_invoice(ocr_data):
    """
    Create one Purchase Invoice from OCR data.
    Called sequentially from JS to show live progress.
    """
    try:
        if isinstance(ocr_data, str):
            ocr_data = json.loads(ocr_data)

        company = (
            frappe.defaults.get_user_default("company")
            or frappe.db.get_single_value("Global Defaults", "default_company")
        )
        if not company:
            return {"success": False, "error": "No default company set"}

        return _create_single_invoice(ocr_data, company)

    except Exception as e:
        frappe.log_error(frappe.get_traceback()[:500], "Single Invoice Create Error")
        return {"success": False, "error": str(e)[:300]}


# ══════════════════════════════════════════════════════════════════════════════
# Step 2b: Create invoices in bulk (kept for backward compatibility)
# ══════════════════════════════════════════════════════════════════════════════

@frappe.whitelist()
def create_invoices(invoices_json):
    """
    Create Purchase Invoices from a list of reviewed OCR data.
    Expects JSON array of {data: {...ocr fields...}, filename: "..."}
    Only called after user reviews and confirms.
    """
    try:
        if isinstance(invoices_json, str):
            invoices_json = json.loads(invoices_json)

        company = (
            frappe.defaults.get_user_default("company")
            or frappe.db.get_single_value("Global Defaults", "default_company")
        )
        if not company:
            return {"success": False, "error": "No default company set"}

        results = []
        created = 0

        for entry in invoices_json:
            ocr_data = entry.get("data", {})
            filename = entry.get("filename", "unknown")
            try:
                pi_result = _create_single_invoice(ocr_data, company)
                if pi_result.get("success"):
                    created += 1
                    results.append({
                        "filename": filename,
                        "success": True,
                        "invoice": pi_result["name"],
                        "supplier": pi_result.get("supplier", ""),
                    })
                else:
                    results.append({
                        "filename": filename,
                        "success": False,
                        "error": pi_result.get("error", "Creation failed"),
                    })
            except Exception as e:
                results.append({
                    "filename": filename,
                    "success": False,
                    "error": str(e)[:200],
                })

        return {
            "success": True,
            "total": len(invoices_json),
            "created": created,
            "failed": len(invoices_json) - created,
            "results": results,
        }

    except Exception as e:
        frappe.log_error(traceback.format_exc()[:500], "Batch Create Error")
        return {"success": False, "error": str(e)[:300]}


def _create_single_invoice(ocr_data, company):
    """Create one Purchase Invoice from OCR data."""
    supplier = (ocr_data.get("supplier") or "").strip() or "Unknown Supplier"

    # Ensure supplier
    if not frappe.db.exists("Supplier", supplier):
        try:
            sup = frappe.new_doc("Supplier")
            sup.supplier_name = supplier
            sup.supplier_group = (
                frappe.db.get_value("Supplier Group", {"is_group": 0}, "name")
                or "All Supplier Groups"
            )
            sup.supplier_type = "Company"
            gstin = ocr_data.get("gstin")
            if gstin:
                sup.tax_id = gstin
            sup.insert(ignore_permissions=True)
            frappe.db.commit()
        except Exception:
            pass

    if not frappe.db.exists("Supplier", supplier):
        return {"success": False, "error": f"Supplier '{supplier}' could not be created"}

    # Auto-create items
    items = ocr_data.get("items") or []
    for item in items:
        item_code = (item.get("item_code") or "").strip()
        item_name = (item.get("item_name") or "").strip()
        if not item_code:
            continue
        if not frappe.db.exists("Item", item_code):
            try:
                itm = frappe.new_doc("Item")
                itm.item_code = item_code
                itm.item_name = item_name or item_code
                itm.description = item_name or item_code
                itm.item_group = (
                    frappe.db.get_value("Item Group", {"is_group": 0}, "name")
                    or "All Item Groups"
                )
                itm.stock_uom = item.get("uom", "Nos")
                itm.is_purchase_item = 1
                itm.is_stock_item = 0
                itm.insert(ignore_permissions=True)
                frappe.db.commit()
            except Exception:
                pass

    # Build PI
    pi = frappe.new_doc("Purchase Invoice")
    pi.company = company
    pi.supplier = supplier
    pi.bill_no = ocr_data.get("bill_no") or None
    pi.bill_date = ocr_data.get("bill_date") or None
    pi.posting_date = ocr_data.get("posting_date") or frappe.utils.nowdate()
    pi.due_date = ocr_data.get("due_date") or None
    pi.set_posting_time = 1

    if items:
        for item in items:
            item_code = (item.get("item_code") or "").strip()
            if not item_code:
                continue
            row = pi.append("items", {})
            row.item_code = item_code
            row.item_name = item.get("item_name") or item_code
            row.description = item.get("item_name") or item_code
            row.qty = item.get("qty") or 1
            row.uom = item.get("uom") or "Nos"
            row.rate = item.get("rate") or 0
            row.amount = item.get("amount") or (row.qty * row.rate)
    else:
        _ensure_placeholder_item()
        row = pi.append("items", {})
        row.item_code = "OCR-PLACEHOLDER"
        row.item_name = "Placeholder (update manually)"
        row.qty = 1
        row.uom = "Nos"
        row.rate = ocr_data.get("grand_total") or 0
        row.amount = ocr_data.get("grand_total") or 0

    taxes = ocr_data.get("taxes") or []
    if taxes:
        tax_accounts = frappe.get_all(
            "Account",
            filters={"company": company, "account_type": "Tax", "is_group": 0, "disabled": 0},
            fields=["name"],
            limit=50,
        )
        for tax in taxes:
            tax_type = tax.get("type", "")
            matched = next((a for a in tax_accounts if tax_type.upper() in a.name.upper()), None)
            if not matched and tax_accounts:
                matched = tax_accounts[0]
            if matched:
                tax_row = pi.append("taxes", {})
                tax_row.charge_type = "Actual"
                tax_row.account_head = matched.name
                tax_row.description = f"{tax_type} @ {tax.get('rate', 0)}%"
                tax_row.rate = tax.get("rate") or 0
                tax_row.tax_amount = tax.get("amount") or 0

    pi.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"success": True, "name": pi.name, "supplier": supplier}


def _ensure_placeholder_item():
    if not frappe.db.exists("Item", "OCR-PLACEHOLDER"):
        try:
            itm = frappe.new_doc("Item")
            itm.item_code = "OCR-PLACEHOLDER"
            itm.item_name = "Placeholder (update manually)"
            itm.description = "Placeholder item from OCR scan"
            itm.item_group = (
                frappe.db.get_value("Item Group", {"is_group": 0}, "name")
                or "All Item Groups"
            )
            itm.stock_uom = "Nos"
            itm.is_purchase_item = 1
            itm.is_stock_item = 0
            itm.insert(ignore_permissions=True)
            frappe.db.commit()
        except Exception:
            pass