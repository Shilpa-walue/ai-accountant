# Vendor Intelligence Dashboard — computed from Purchase Invoice + Payment Entry data

import frappe
from frappe.utils import nowdate, add_months, getdate, flt, cint
from datetime import datetime
import json


@frappe.whitelist()
def get_supplier_intelligence(supplier):
    """Main entry point — returns all intelligence data for a supplier."""
    company = (
        frappe.defaults.get_user_default("company")
        or frappe.db.get_single_value("Global Defaults", "default_company")
    )
    if not company:
        return {"success": False, "error": "No default company set"}

    fy_start = _get_fy_start(company)
    last_fy_start = add_months(fy_start, -12)

    return {
        "success": True,
        "summary": _get_summary(supplier, company, fy_start, last_fy_start),
        "spend_trend": _get_spend_trend(supplier, company),
        "price_history": _get_price_history(supplier, company),
        "risk_flags": _get_risk_flags(supplier, company),
        "invoices": _get_recent_invoices(supplier, company),
    }


# ── Summary Cards ─────────────────────────────────────────────────────────────

def _get_summary(supplier, company, fy_start, last_fy_start):
    """Total spend, avg invoice, avg payment days, price trend."""

    # Total spend this FY
    total_spend = flt(frappe.db.sql("""
        SELECT IFNULL(SUM(grand_total), 0)
        FROM `tabPurchase Invoice`
        WHERE supplier = %s AND company = %s AND docstatus = 1
        AND posting_date >= %s
    """, (supplier, company, fy_start))[0][0])

    # Total spend last FY
    last_fy_spend = flt(frappe.db.sql("""
        SELECT IFNULL(SUM(grand_total), 0)
        FROM `tabPurchase Invoice`
        WHERE supplier = %s AND company = %s AND docstatus = 1
        AND posting_date >= %s AND posting_date < %s
    """, (supplier, company, last_fy_start, fy_start))[0][0])

    spend_change = 0
    if last_fy_spend > 0:
        spend_change = round(((total_spend - last_fy_spend) / last_fy_spend) * 100, 1)

    # Invoice count this FY
    invoice_count = cint(frappe.db.sql("""
        SELECT COUNT(*)
        FROM `tabPurchase Invoice`
        WHERE supplier = %s AND company = %s AND docstatus = 1
        AND posting_date >= %s
    """, (supplier, company, fy_start))[0][0])

    avg_invoice = round(total_spend / invoice_count, 0) if invoice_count else 0

    # Total invoice count (all time)
    total_invoices = cint(frappe.db.sql("""
        SELECT COUNT(*)
        FROM `tabPurchase Invoice`
        WHERE supplier = %s AND company = %s AND docstatus = 1
    """, (supplier, company))[0][0])

    # Avg payment days
    avg_payment_days = _get_avg_payment_days(supplier, company)

    # First invoice date (supplier since)
    first_invoice = frappe.db.sql("""
        SELECT MIN(posting_date)
        FROM `tabPurchase Invoice`
        WHERE supplier = %s AND company = %s AND docstatus = 1
    """, (supplier, company))[0][0]

    supplier_since = ""
    if first_invoice:
        supplier_since = getdate(first_invoice).strftime("%b %Y")

    # Price trend — most purchased item, compare earliest vs latest rate
    price_trend = _get_top_item_price_trend(supplier, company)

    # Risk level
    risk_flags = _get_risk_flags(supplier, company)
    risk_count = len(risk_flags)
    if risk_count == 0:
        risk_level = "Low Risk"
    elif risk_count <= 2:
        risk_level = "Medium Risk"
    else:
        risk_level = "High Risk"

    return {
        "total_spend": total_spend,
        "spend_change": spend_change,
        "avg_invoice": avg_invoice,
        "invoice_count_fy": invoice_count,
        "total_invoices": total_invoices,
        "avg_payment_days": avg_payment_days,
        "supplier_since": supplier_since,
        "risk_level": risk_level,
        "risk_count": risk_count,
        "price_trend": price_trend,
    }


def _get_avg_payment_days(supplier, company):
    """AVG(DATEDIFF(payment_date, invoice_date)) from Payment Entry."""
    result = frappe.db.sql("""
        SELECT AVG(DATEDIFF(pe.posting_date, pi.posting_date)) as avg_days
        FROM `tabPayment Entry Reference` per
        JOIN `tabPayment Entry` pe ON pe.name = per.parent
        JOIN `tabPurchase Invoice` pi ON pi.name = per.reference_name
        WHERE per.reference_doctype = 'Purchase Invoice'
        AND pi.supplier = %s AND pi.company = %s
        AND pi.docstatus = 1 AND pe.docstatus = 1
    """, (supplier, company))

    if result and result[0][0] is not None:
        return round(flt(result[0][0]))
    return None


def _get_top_item_price_trend(supplier, company):
    """Find most purchased item and its price change."""
    top_item = frappe.db.sql("""
        SELECT pii.item_code, pii.item_name,
               SUM(pii.qty) as total_qty
        FROM `tabPurchase Invoice Item` pii
        JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent
        WHERE pi.supplier = %s AND pi.company = %s AND pi.docstatus = 1
        GROUP BY pii.item_code
        ORDER BY total_qty DESC
        LIMIT 1
    """, (supplier, company), as_dict=True)

    if not top_item:
        return None

    item = top_item[0]

    # Get earliest and latest rate
    rates = frappe.db.sql("""
        SELECT pii.rate, pi.posting_date
        FROM `tabPurchase Invoice Item` pii
        JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent
        WHERE pi.supplier = %s AND pi.company = %s AND pi.docstatus = 1
        AND pii.item_code = %s
        ORDER BY pi.posting_date ASC
    """, (supplier, company, item.item_code), as_dict=True)

    if len(rates) < 2:
        return None

    earliest_rate = flt(rates[0].rate)
    latest_rate = flt(rates[-1].rate)
    pct_change = 0
    if earliest_rate > 0:
        pct_change = round(((latest_rate - earliest_rate) / earliest_rate) * 100, 1)

    return {
        "item_name": item.item_name or item.item_code,
        "earliest_rate": earliest_rate,
        "latest_rate": latest_rate,
        "pct_change": pct_change,
    }


# ── Spend Trend (Monthly) ────────────────────────────────────────────────────

def _get_spend_trend(supplier, company):
    """Monthly spend for last 12 months."""
    twelve_months_ago = add_months(nowdate(), -12)

    data = frappe.db.sql("""
        SELECT
            DATE_FORMAT(posting_date, '%%Y-%%m') as month,
            DATE_FORMAT(posting_date, '%%b') as month_label,
            SUM(grand_total) as total
        FROM `tabPurchase Invoice`
        WHERE supplier = %s AND company = %s AND docstatus = 1
        AND posting_date >= %s
        GROUP BY DATE_FORMAT(posting_date, '%%Y-%%m')
        ORDER BY month ASC
    """, (supplier, company, twelve_months_ago), as_dict=True)

    # Fill in missing months with 0
    result = []
    current = getdate(twelve_months_ago).replace(day=1)
    today = getdate(nowdate())

    month_map = {d.month: d for d in data}

    while current <= today:
        key = current.strftime("%Y-%m")
        label = current.strftime("%b")
        total = flt(month_map.get(key, {}).get("total", 0) if key in month_map else 0)
        result.append({"month": key, "label": label, "total": round(total, 0)})
        # Next month
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)

    return result


# ── Price History ─────────────────────────────────────────────────────────────

def _get_price_history(supplier, company):
    """Per-item rates across invoices, grouped by item_code ordered by date."""
    data = frappe.db.sql("""
        SELECT
            pii.item_code,
            pii.item_name,
            pii.rate,
            pii.qty,
            pii.uom,
            pi.posting_date,
            pi.name as invoice
        FROM `tabPurchase Invoice Item` pii
        JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent
        WHERE pi.supplier = %s AND pi.company = %s AND pi.docstatus = 1
        ORDER BY pii.item_code, pi.posting_date ASC
    """, (supplier, company), as_dict=True)

    # Group by item
    items = {}
    for row in data:
        code = row.item_code
        if code not in items:
            items[code] = {
                "item_code": code,
                "item_name": row.item_name,
                "history": [],
            }
        items[code]["history"].append({
            "date": str(row.posting_date),
            "rate": flt(row.rate),
            "qty": flt(row.qty),
            "uom": row.uom,
            "invoice": row.invoice,
        })

    # Add price change info
    result = []
    for code, item in items.items():
        h = item["history"]
        if len(h) >= 2:
            first_rate = h[0]["rate"]
            last_rate = h[-1]["rate"]
            item["change_pct"] = round(((last_rate - first_rate) / first_rate) * 100, 1) if first_rate else 0
            item["latest_rate"] = last_rate
        elif len(h) == 1:
            item["change_pct"] = 0
            item["latest_rate"] = h[0]["rate"]
        else:
            item["change_pct"] = 0
            item["latest_rate"] = 0
        result.append(item)

    return result


# ── Risk Flags ────────────────────────────────────────────────────────────────

def _get_risk_flags(supplier, company):
    """Auto-computed audit risk flags."""
    flags = []

    # 1. Spend spike — current month > 2x average of last 6 months
    six_months_ago = add_months(nowdate(), -6)
    current_month = getdate(nowdate()).strftime("%Y-%m")

    monthly_avg = frappe.db.sql("""
        SELECT AVG(monthly_total) as avg_spend FROM (
            SELECT SUM(grand_total) as monthly_total
            FROM `tabPurchase Invoice`
            WHERE supplier = %s AND company = %s AND docstatus = 1
            AND posting_date >= %s
            AND DATE_FORMAT(posting_date, '%%Y-%%m') != %s
            GROUP BY DATE_FORMAT(posting_date, '%%Y-%%m')
        ) as monthly
    """, (supplier, company, six_months_ago, current_month))

    current_spend = flt(frappe.db.sql("""
        SELECT IFNULL(SUM(grand_total), 0)
        FROM `tabPurchase Invoice`
        WHERE supplier = %s AND company = %s AND docstatus = 1
        AND DATE_FORMAT(posting_date, '%%Y-%%m') = %s
    """, (supplier, company, current_month))[0][0])

    avg_spend = flt(monthly_avg[0][0]) if monthly_avg and monthly_avg[0][0] else 0
    if avg_spend > 0 and current_spend > (avg_spend * 2):
        flags.append({
            "type": "spend_spike",
            "severity": "high",
            "title": "Spend Spike Detected",
            "detail": f"Current month spend (₹{current_spend:,.0f}) is {round(current_spend/avg_spend, 1)}x the 6-month average (₹{avg_spend:,.0f})",
        })

    # 2. Single source — check if this supplier is the only one for any item
    single_source = frappe.db.sql("""
        SELECT pii.item_code, pii.item_name
        FROM `tabPurchase Invoice Item` pii
        JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent
        WHERE pi.company = %s AND pi.docstatus = 1
        AND pii.item_code IN (
            SELECT pii2.item_code
            FROM `tabPurchase Invoice Item` pii2
            JOIN `tabPurchase Invoice` pi2 ON pi2.name = pii2.parent
            WHERE pi2.supplier = %s AND pi2.company = %s AND pi2.docstatus = 1
        )
        GROUP BY pii.item_code
        HAVING COUNT(DISTINCT pi.supplier) = 1
        LIMIT 5
    """, (company, supplier, company), as_dict=True)

    if single_source:
        item_names = ", ".join([s.item_name or s.item_code for s in single_source[:3]])
        flags.append({
            "type": "single_source",
            "severity": "medium",
            "title": "Single-Source Dependency",
            "detail": f"This supplier is the only vendor for: {item_names}" + (f" (+{len(single_source)-3} more)" if len(single_source) > 3 else ""),
        })

    # 3. Late payments — if avg payment days > 45
    avg_days = _get_avg_payment_days(supplier, company)
    if avg_days and avg_days > 45:
        flags.append({
            "type": "late_payment",
            "severity": "medium",
            "title": "Slow Payment History",
            "detail": f"Average payment takes {avg_days} days — may affect vendor relationship",
        })

    # 4. Price increase > 15% on any item in last 6 months
    price_jumps = frappe.db.sql("""
        SELECT item_code, item_name, old_rate, new_rate,
               ROUND(((new_rate - old_rate) / old_rate) * 100, 1) as pct
        FROM (
            SELECT pii.item_code, pii.item_name,
                   FIRST_VALUE(pii.rate) OVER (PARTITION BY pii.item_code ORDER BY pi.posting_date ASC) as old_rate,
                   LAST_VALUE(pii.rate) OVER (PARTITION BY pii.item_code ORDER BY pi.posting_date ASC
                       ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as new_rate
            FROM `tabPurchase Invoice Item` pii
            JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent
            WHERE pi.supplier = %s AND pi.company = %s AND pi.docstatus = 1
            AND pi.posting_date >= %s
        ) sub
        WHERE old_rate > 0 AND ((new_rate - old_rate) / old_rate) > 0.15
        GROUP BY item_code
        LIMIT 3
    """, (supplier, company, six_months_ago), as_dict=True)

    if price_jumps:
        for pj in price_jumps:
            flags.append({
                "type": "price_increase",
                "severity": "high" if flt(pj.pct) > 25 else "medium",
                "title": f"Price Increase — {pj.item_name or pj.item_code}",
                "detail": f"Rate increased {pj.pct}% (₹{flt(pj.old_rate):,.0f} → ₹{flt(pj.new_rate):,.0f}) in last 6 months",
            })

    # 5. Missing GSTIN
    supplier_doc = frappe.get_doc("Supplier", supplier)
    if not supplier_doc.tax_id:
        flags.append({
            "type": "missing_gstin",
            "severity": "low",
            "title": "Missing GSTIN",
            "detail": "No GSTIN/Tax ID on file — may affect GST input credit claims",
        })

    return flags


# ── Recent Invoices ───────────────────────────────────────────────────────────

def _get_recent_invoices(supplier, company):
    """Last 20 invoices for the invoices tab."""
    return frappe.db.sql("""
        SELECT
            pi.name,
            pi.posting_date,
            pi.bill_no,
            pi.grand_total,
            pi.outstanding_amount,
            pi.status,
            pi.due_date
        FROM `tabPurchase Invoice` pi
        WHERE pi.supplier = %s AND pi.company = %s AND pi.docstatus = 1
        ORDER BY pi.posting_date DESC
        LIMIT 20
    """, (supplier, company), as_dict=True)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_fy_start(company):
    """Get current fiscal year start date."""
    try:
        fy = frappe.db.sql("""
            SELECT year_start_date
            FROM `tabFiscal Year`
            WHERE %s BETWEEN year_start_date AND year_end_date
            AND (company = %s OR company = '' OR company IS NULL)
            ORDER BY year_start_date DESC
            LIMIT 1
        """, (nowdate(), company))
        if fy:
            return str(fy[0][0])
    except Exception:
        pass
    # Fallback: April 1 of current year
    today = getdate(nowdate())
    if today.month >= 4:
        return f"{today.year}-04-01"
    return f"{today.year - 1}-04-01"