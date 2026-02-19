// ai_accountant/public/js/purchase_invoice.js

frappe.ui.form.on("Purchase Invoice", {
    refresh(frm) {
        if (frm.doc.docstatus === 0) {

            $(".page-actions .btn").filter(function(){
            return $(this).text().trim().indexOf("Smart Scan") !== -1;
            }).remove();

            var already_scanned = frm.doc.__ocr_done;

            var $btn = frm.page.add_button("Smart Scan", function () {
                if (already_scanned) return;
                show_upload_dialog(frm);
            });

            // ── Button style ──────────────────────────────────────────
            $btn.removeClass("btn-default btn-secondary")
                .css({
                    "background-color": already_scanned ? "#94a3b8" : "#1a5ddb",
                    "border-color":     already_scanned ? "#94a3b8" : "#1a5ddb",
                    "color":            "#ffffff",
                    "border-radius":    "6px",
                    "padding":          "5px 14px",
                    "font-weight":      "500",
                    "display":          "inline-flex",
                    "align-items":      "center",
                    "gap":              "7px",
                    "cursor":           already_scanned ? "not-allowed" : "pointer",
                    "opacity":          already_scanned ? "0.6" : "1"
                });

            $btn.html(`
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                     stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="7" y1="8"  x2="17" y2="8"/>
                    <line x1="7" y1="12" x2="17" y2="12"/>
                    <line x1="7" y1="16" x2="13" y2="16"/>
                </svg>
                <span>Smart Scan</span>
                ${already_scanned
                    ? '<span style="background:#fff;color:#64748b;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;">DONE</span>'
                    : '<span style="background:#fff;color:#1a5ddb;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;">NEW</span>'
                }
            `);

            // ── Re-inject banners if already scanned (on reload) ──────
            if (already_scanned) {
                inject_success_banner(frm);
                inject_warning_banner(frm);
            }
        }
    }
});

// ── Upload dialog ─────────────────────────────────────────────────────────────
function show_upload_dialog(frm) {
    var selected_file = null;

    if (!document.getElementById("ocr-dlg-css")) {
        $("<style id='ocr-dlg-css'>").text(`
            .ocr-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:9999;display:flex;align-items:center;justify-content:center;}
            .ocr-modal{background:#fff;border-radius:18px;padding:38px 36px 30px;width:540px;max-width:93vw;box-shadow:0 25px 80px rgba(0,0,0,.25);position:relative;animation:ocr-pop .18s ease;}
            @keyframes ocr-pop{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
            .ocr-x{position:absolute;top:20px;right:22px;font-size:22px;line-height:1;color:#9ca3af;background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:6px;}
            .ocr-x:hover{background:#f3f4f6;color:#374151;}
            .ocr-title{font-size:22px;font-weight:700;color:#0f172a;margin:0 0 5px;}
            .ocr-sub{font-size:14px;color:#94a3b8;margin:0 0 26px;}
            .ocr-drop{border:2px dashed #cbd5e1;border-radius:14px;padding:52px 24px 44px;text-align:center;cursor:pointer;transition:all .2s;background:#f8fafc;min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;}
            .ocr-drop:hover,.ocr-drop.drag-over{border-color:#2563eb;background:#eff6ff;}
            .ocr-icon-wrap{width:72px;height:72px;border-radius:18px;background:#dbeafe;display:flex;align-items:center;justify-content:center;margin-bottom:18px;}
            .ocr-drop-label{font-size:17px;font-weight:700;color:#1e293b;margin:0 0 6px;}
            .ocr-drop-label a{color:#2563eb;text-decoration:underline;cursor:pointer;text-underline-offset:2px;}
            .ocr-drop-hint{font-size:13px;color:#94a3b8;margin:0;}
            .ocr-file-card{display:flex;align-items:center;gap:12px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:13px 16px;text-align:left;width:100%;box-sizing:border-box;}
            .ocr-file-name{font-size:13.5px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px;}
            .ocr-file-size{font-size:12px;color:#94a3b8;margin-top:2px;}
            .ocr-file-rm{margin-left:auto;cursor:pointer;color:#94a3b8;background:none;border:none;font-size:20px;line-height:1;flex-shrink:0;}
            .ocr-file-rm:hover{color:#ef4444;}
            .ocr-warn{display:flex;align-items:flex-start;gap:11px;margin-top:20px;background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:15px 16px;font-size:13.5px;color:#92400e;line-height:1.55;}
            .ocr-warn svg{flex-shrink:0;margin-top:1px;}
            .ocr-footer{display:flex;justify-content:space-between;align-items:center;margin-top:28px;}
            .ocr-btn-cancel{background:#fff;border:1.5px solid #d1d5db;border-radius:9px;padding:10px 26px;font-size:14.5px;font-weight:500;color:#374151;cursor:pointer;}
            .ocr-btn-cancel:hover{border-color:#9ca3af;background:#f9fafb;}
            .ocr-btn-extract{background:#1e3a8a;border:none;border-radius:9px;padding:11px 30px;font-size:14.5px;font-weight:600;color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:9px;transition:background .15s;}
            .ocr-btn-extract:hover:not(:disabled){background:#1e40af;}
            .ocr-btn-extract:disabled{opacity:.4;cursor:not-allowed;}
        `).appendTo("head");
    }

    var $overlay = $(`
        <div class="ocr-overlay">
          <div class="ocr-modal">
            <button class="ocr-x" id="ocr-close">&times;</button>
            <h2 class="ocr-title">Upload Invoice</h2>
            <p class="ocr-sub">We'll extract details automatically</p>
            <div class="ocr-drop" id="ocr-drop">
              <div id="ocr-empty">
                <div class="ocr-icon-wrap">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <p class="ocr-drop-label">Drag &amp; drop or <a id="ocr-browse">browse files</a></p>
                <p class="ocr-drop-hint">PDF format only &middot; Max 10 MB</p>
              </div>
              <div id="ocr-file-card" style="display:none;" class="ocr-file-card">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <div style="min-width:0;flex:1;">
                  <div class="ocr-file-name" id="ocr-fname">—</div>
                  <div class="ocr-file-size" id="ocr-fsize"></div>
                </div>
                <button class="ocr-file-rm" id="ocr-remove">&times;</button>
              </div>
            </div>
            <div class="ocr-warn">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>Upload a <strong>single PDF</strong> containing one invoice. Scanned images and multi-page invoices are supported. Password-protected files are not supported.</span>
            </div>
            <div class="ocr-footer">
              <button class="ocr-btn-cancel" id="ocr-cancel">Cancel</button>
              <button class="ocr-btn-extract" id="ocr-extract" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Extract &amp; Fill
              </button>
            </div>
          </div>
        </div>
    `).appendTo("body");

    var $input = $('<input type="file" accept=".pdf" style="display:none">').appendTo("body");

    function fmt_size(b){ return b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(1)+" MB"; }
    function set_file(file){
        if (!file) return;
        if (file.type!=="application/pdf"){ frappe.show_alert({message:"Only PDF files allowed",indicator:"red"}); return; }
        if (file.size>10485760){ frappe.show_alert({message:"Max 10 MB",indicator:"red"}); return; }
        selected_file=file;
        $overlay.find("#ocr-empty").hide();
        $overlay.find("#ocr-file-card").show();
        $overlay.find("#ocr-fname").text(file.name);
        $overlay.find("#ocr-fsize").text(fmt_size(file.size));
        $overlay.find("#ocr-extract").prop("disabled",false);
    }
    function close_dlg(){ $overlay.remove(); $input.remove(); }

    $overlay.find("#ocr-close,#ocr-cancel").on("click", close_dlg);
    $overlay.on("click", function(e){ if($(e.target).hasClass("ocr-overlay")) close_dlg(); });
    $overlay.find("#ocr-drop").on("click", function(e){
        if(!$(e.target).is("#ocr-remove")&&!$(e.target).closest("#ocr-remove").length) $input.trigger("click");
    });
    $overlay.find("#ocr-browse").on("click", function(e){ e.stopPropagation(); $input.trigger("click"); });
    $input.on("change", function(){ if(this.files&&this.files[0]) set_file(this.files[0]); });
    $overlay.find("#ocr-remove").on("click", function(e){
        e.stopPropagation(); selected_file=null; $input.val("");
        $overlay.find("#ocr-file-card").hide();
        $overlay.find("#ocr-empty").show();
        $overlay.find("#ocr-extract").prop("disabled",true);
    });
    $overlay.find("#ocr-drop")
        .on("dragover dragenter",function(e){ e.preventDefault();e.stopPropagation();$(this).addClass("drag-over"); })
        .on("dragleave",function(e){ e.preventDefault();e.stopPropagation();$(this).removeClass("drag-over"); })
        .on("drop",function(e){
            e.preventDefault();e.stopPropagation();$(this).removeClass("drag-over");
            var f=e.originalEvent.dataTransfer.files[0]; if(f) set_file(f);
        });

    $overlay.find("#ocr-extract").on("click", function(){
        if (!selected_file) return;
        close_dlg();
        show_loading_screen();

        var fd=new FormData();
        fd.append("file", selected_file, selected_file.name);
        fd.append("is_private","1");
        fd.append("folder","Home/Attachments");

        fetch("/api/method/upload_file",{
            method:"POST",
            headers:{"X-Frappe-CSRF-Token":frappe.csrf_token},
            body:fd
        })
        .then(function(r){ return r.json(); })
        .then(function(resp){
            if (!resp.message||!resp.message.file_url){
                hide_loading_screen(); frappe.msgprint("Upload failed."); return;
            }
            set_step_done(1);
            set_step_active(2,"Extracting invoice data...");
            call_ocr(frm, resp.message.file_url);
        })
        .catch(function(err){ hide_loading_screen(); frappe.msgprint("Upload error: "+err.message); });
    });
}

// ── Loading screen ────────────────────────────────────────────────────────────
function show_loading_screen(){
    if (!document.getElementById("ocr-load-css")) {
        $("<style id='ocr-load-css'>").text(`
            .ocr-load-bg{position:fixed;inset:0;background:#f1f5f9;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:inherit;}
            .ocr-spinner{width:76px;height:76px;border-radius:50%;border:5px solid #e2e8f0;border-top-color:#2563eb;animation:ocr-spin .85s linear infinite;margin-bottom:30px;}
            @keyframes ocr-spin{to{transform:rotate(360deg)}}
            .ocr-load-title{font-size:23px;font-weight:700;color:#0f172a;margin:0 0 9px;text-align:center;}
            .ocr-load-sub{font-size:15px;color:#94a3b8;margin:0 0 48px;text-align:center;}
            .ocr-steps{width:300px;display:flex;flex-direction:column;gap:0;}
            .ocr-step{display:flex;align-items:flex-start;gap:16px;position:relative;}
            .ocr-step+.ocr-step{margin-top:8px;}
            .ocr-step-col{display:flex;flex-direction:column;align-items:center;}
            .ocr-step-line{width:2px;flex:1;min-height:24px;background:#e2e8f0;margin:3px 0;}
            .ocr-step-icon{width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
            .ocr-step-icon.done{background:#dcfce7;border:2px solid #86efac;}
            .ocr-step-icon.active{background:#dbeafe;border:2px solid #93c5fd;}
            .ocr-step-icon.wait{background:#f1f5f9;border:2px solid #e2e8f0;}
            .ocr-step-text{padding-top:7px;font-size:15.5px;line-height:1.4;}
            .ocr-step-text.done{color:#16a34a;font-weight:600;}
            .ocr-step-text.active{color:#0f172a;font-weight:700;}
            .ocr-step-text.wait{color:#94a3b8;font-weight:400;}
            .ocr-dot-pulse{width:11px;height:11px;border-radius:50%;background:#2563eb;animation:ocr-pulse 1.3s ease-in-out infinite;}
            @keyframes ocr-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.65}}
        `).appendTo("head");
    }

    $(`<div class="ocr-load-bg" id="ocr-loading">
        <div class="ocr-spinner"></div>
        <p class="ocr-load-title" id="ocr-load-title">Reading your invoice...</p>
        <p class="ocr-load-sub"  id="ocr-load-sub">This usually takes 5–15 seconds</p>
        <div class="ocr-steps">
          <div class="ocr-step" id="ocr-s1">
            <div class="ocr-step-col">
              <div class="ocr-step-icon active" id="ocr-s1-icon"><div class="ocr-dot-pulse"></div></div>
              <div class="ocr-step-line"></div>
            </div>
            <div class="ocr-step-text active" id="ocr-s1-text">Uploading file...</div>
          </div>
          <div class="ocr-step" id="ocr-s2">
            <div class="ocr-step-col">
              <div class="ocr-step-icon wait" id="ocr-s2-icon"></div>
              <div class="ocr-step-line"></div>
            </div>
            <div class="ocr-step-text wait" id="ocr-s2-text">Extracting invoice data</div>
          </div>
          <div class="ocr-step" id="ocr-s3">
            <div class="ocr-step-col">
              <div class="ocr-step-icon wait" id="ocr-s3-icon"></div>
            </div>
            <div class="ocr-step-text wait" id="ocr-s3-text">Mapping to form fields</div>
          </div>
        </div>
    </div>`).appendTo("body");
}

var CHECK = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function set_step_done(n){
    $("#ocr-s"+n+"-icon").removeClass("wait active").addClass("done").html(CHECK);
    $("#ocr-s"+n+"-text").removeClass("wait active").addClass("done");
}
function set_step_active(n, label){
    $("#ocr-s"+n+"-icon").removeClass("wait done").addClass("active").html('<div class="ocr-dot-pulse"></div>');
    $("#ocr-s"+n+"-text").removeClass("wait done").addClass("active").text(label);
}
function hide_loading_screen(){
    set_step_done(1); set_step_done(2); set_step_done(3);
    $("#ocr-s3-text").text("Form fields mapped");
    $("#ocr-load-title").text("Done! ✓");
    $("#ocr-load-sub").text("");
    setTimeout(function(){ $("#ocr-loading").fadeOut(350,function(){ $(this).remove(); }); }, 650);
}

// ── OCR call ──────────────────────────────────────────────────────────────────
function call_ocr(frm, file_url){
    frappe.call({
        method:"ai_accountant.api.ocr.smart_scan",
        args:{file_url:file_url},
        callback:function(r){
            if (!r||!r.message){ hide_loading_screen(); frappe.msgprint("No response."); return; }
            if (!r.message.success){ hide_loading_screen(); frappe.msgprint("OCR Failed: "+(r.message.error||"Unknown")); return; }
            set_step_done(2);
            set_step_active(3,"Mapping to form fields...");
            $("#ocr-load-title").text("Reading your invoice...");
            $("#ocr-load-sub").text("This usually takes 5-15 seconds");
            setTimeout(function(){ apply_and_save(frm, r.message); }, 600);
        }
    });
}

// ── Apply data + show success banner + disable button ────────────────────────
function apply_and_save(frm, d){
    if (d.supplier)     frm.set_value("supplier",     d.supplier);
    if (d.bill_no)      frm.set_value("bill_no",      d.bill_no);
    if (d.bill_date)    frm.set_value("bill_date",    d.bill_date);
    if (d.posting_date) frm.set_value("posting_date", d.posting_date);
    if (d.due_date)     frm.set_value("due_date",     d.due_date);

    if (d.items&&d.items.length>0){
        frm.clear_table("items");
        d.items.forEach(function(item){
            var row=frm.add_child("items");
            row.item_code=item.item_code||item.item_name;
            row.item_name=item.item_name;
            row.description=item.item_name;
            row.qty=item.qty||1;
            row.uom=item.uom||"Nos";
            row.rate=item.rate||0;
            row.amount=item.amount||(row.qty*row.rate);
        });
        frm.refresh_field("items");
    }

    if (d.taxes&&d.taxes.length>0){
        var company=frm.doc.company||frappe.defaults.get_default("company");
        frappe.call({
            method:"frappe.client.get_list",
            args:{doctype:"Account",filters:[["company","=",company],["account_type","=","Tax"],["is_group","=",0],["disabled","=",0]],fields:["name"],limit:50},
            callback:function(res){
                var accounts=res.message||[];
                frm.clear_table("taxes");
                d.taxes.forEach(function(tax){
                    var matched=accounts.find(function(a){ return a.name.toUpperCase().indexOf(tax.type.toUpperCase())!==-1; });
                    if (!matched&&accounts.length>0) matched=accounts[0];
                    if (matched){
                        var row=frm.add_child("taxes");
                        row.charge_type="Actual";
                        row.account_head=matched.name;
                        row.description=tax.type+" @ "+tax.rate+"%";
                        row.rate=tax.rate||0;
                        row.tax_amount=tax.amount||0;
                    }
                });
                frm.refresh_field("taxes");
                save_draft(frm, d);
            }
        });
    } else {
        save_draft(frm, d);
    }
}

// ── Save draft ────────────────────────────────────────────────────────────────
function save_draft(frm, d){
    frm.save("Save", function(){
        hide_loading_screen();

        // ── 1. Mark form as scanned so button stays disabled on refresh ──
        frm.doc.__ocr_done = true;

        // ── 2. Disable Smart Scan button ────────────────────────────────
        frm.page.btn_primary    // find our button by text
        $(".page-actions .btn").filter(function(){
            return $(this).text().trim().indexOf("Smart Scan") !== -1;
        }).css({
            "background-color": "#94a3b8",
            "border-color":     "#94a3b8",
            "opacity":          "0.6",
            "cursor":           "not-allowed"
        }).off("click").on("click", function(e){ e.stopPropagation(); });

        // Update badge: NEW → DONE
        $(".page-actions .btn").filter(function(){
            return $(this).text().trim().indexOf("Smart Scan") !== -1;
        }).find("span:last-child").css("color","#64748b").text("DONE");

        // ── 3. Add Auto-filled badges to field labels ────────────────────
        inject_autofilled_badges(d);

        // ── 4. Inject success banner at top of form ──────────────────────
        inject_success_banner(frm);

        // ── 5. Inject warning banner at bottom of form ───────────────────
        inject_warning_banner(frm);
    });
}

// ── Auto-filled badges next to field labels ───────────────────────────────────
function inject_autofilled_badges(d){
    if (!document.getElementById("ocr-badge-css")){
        $("<style id='ocr-badge-css'>").text(`
            .ocr-autofill-badge {
                display:inline-block;
                background:#eff6ff;
                color:#2563eb;
                font-size:10.5px;
                font-weight:600;
                padding:1px 8px;
                border-radius:20px;
                border:1px solid #bfdbfe;
                margin-left:8px;
                vertical-align:middle;
                letter-spacing:0.2px;
            }
        `).appendTo("head");
    }

    var badge = '<span class="ocr-autofill-badge">Auto-filled</span>';

    // Map fieldname → label text shown in ERPNext
    var fields = [];
    if (d.supplier)     fields.push("supplier");
    if (d.bill_date)    fields.push("bill_date");
    if (d.bill_no)      fields.push("bill_no");
    if (d.due_date)     fields.push("due_date");
    if (d.posting_date) fields.push("posting_date");

    fields.forEach(function(fn){
        // ERPNext renders label in .control-label inside [data-fieldname="fn"]
        var $label = $('[data-fieldname="'+fn+'"] .control-label, [data-fieldname="'+fn+'"] label');
        if ($label.length && !$label.find(".ocr-autofill-badge").length){
            $label.first().append(badge);
        }
    });
}

// ── Success banner (top of form) ──────────────────────────────────────────────
function inject_success_banner(frm){
    if (!document.getElementById("ocr-banner-css")){
        $("<style id='ocr-banner-css'>").text(`
            .ocr-success-banner {
                display:flex;align-items:flex-start;gap:14px;
                background:#eff6ff;
                border:1.5px solid #bfdbfe;
                border-left:5px solid #2563eb;
                border-radius:10px;
                padding:16px 18px;
                margin:0 0 20px 0;
                position:relative;
            }
            .ocr-banner-icon {
                width:36px;height:36px;flex-shrink:0;border-radius:8px;
                background:#2563eb;
                display:flex;align-items:center;justify-content:center;
            }
            .ocr-banner-title {
                font-size:15px;font-weight:700;color:#1e40af;margin:0 0 4px;
            }
            .ocr-banner-desc {
                font-size:13px;color:#3b82f6;margin:0;line-height:1.5;
            }
            .ocr-banner-close {
                position:absolute;top:12px;right:14px;
                font-size:18px;color:#93c5fd;background:none;
                border:none;cursor:pointer;line-height:1;padding:2px 5px;
            }
            .ocr-banner-close:hover{color:#1e40af;}
        `).appendTo("head");
    }

    // Remove if already exists
    $(".ocr-success-banner").remove();

    var $banner = $(`
        <div class="ocr-success-banner">
            <div class="ocr-banner-icon">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
                     stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>
            <div>
                <p class="ocr-banner-title">Invoice data auto-filled via Smart Scan</p>
                <p class="ocr-banner-desc">Fields highlighted in blue were populated from your PDF. Please review all entries — especially amounts and line items — before submitting.</p>
            </div>
            <button class="ocr-banner-close" title="Dismiss">&times;</button>
        </div>
    `);

    $banner.find(".ocr-banner-close").on("click", function(){ $banner.remove(); });

    // Inject right after the form's header area (before first section)
    var $target = $(frm.wrapper).find(".form-layout").first();
    if ($target.length){
        $target.prepend($banner);
    } else {
        $(frm.wrapper).find(".page-content").prepend($banner);
    }
}

// ── Warning banner (bottom of form) ───────────────────────────────────────────
function inject_warning_banner(frm){
    if (!document.getElementById("ocr-warn-banner-css")){
        $("<style id='ocr-warn-banner-css'>").text(`
            .ocr-warn-banner {
                display:flex;align-items:center;gap:12px;
                background:#fffbeb;
                border:1.5px solid #fde68a;
                border-left:5px solid #f59e0b;
                border-radius:10px;
                padding:14px 18px;
                margin:20px 0 0 0;
            }
            .ocr-warn-banner svg { flex-shrink:0; }
            .ocr-warn-banner p {
                margin:0;font-size:13.5px;color:#92400e;line-height:1.5;
            }
            .ocr-warn-banner strong {
                color:#b45309;font-weight:700;
            }
        `).appendTo("head");
    }

    // Remove if already exists
    $(".ocr-warn-banner").remove();

    var $banner = $(`
        <div class="ocr-warn-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="#d97706" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p><strong>Auto-filled from PDF.</strong> Please verify all entries — especially amounts and taxes — before submitting.</p>
        </div>
    `);

    var $target = $(frm.wrapper).find(".form-layout").first();
    if ($target.length){
        $target.append($banner);
    } else {
        $(frm.wrapper).find(".page-content").append($banner);
    }
}
