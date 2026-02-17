frappe.ui.form.on('Document Upload', {
    refresh: function(frm) {
        frm.add_custom_button('Run OCR', function() {
            frappe.call({
                method: 'ai_accountant.ai_accountant.doctype.document_upload.document_upload.process_paddle_ocr',
                args: { docname: frm.doc.name },
                freeze: true,
                freeze_message: 'Processing with PaddleOCR...',
                callback: function(r) {
                    if (r.message && r.message.success) {
                        frappe.msgprint('OCR Completed');
                        frm.reload_doc();
                    } else {
                        frappe.msgprint(r.message.message || "Error occurred");
                    }
                }
            });
        }).addClass('btn-primary');
    }
});
