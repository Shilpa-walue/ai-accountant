import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_field

def create_purchase_invoice_fields():
    fields = [
        {
            "fieldname": "upload_log_id",
            "label": "Upload Log ID",
            "fieldtype": "Data",
            "insert_after": "supplier",
            "read_only": 0,
            "no_copy": 1,
            "in_list_view": 1
        }
    ]

    for field in fields:
        if not frappe.db.exists("Custom Field", {
            "dt": "Purchase Invoice",
            "fieldname": field["fieldname"]
        }):
            create_custom_field("Purchase Invoice", field)