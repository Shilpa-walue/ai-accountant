// ai_accountant/public/js/purchase_invoice_list.js
// Smart Scan — ZIP upload → Review Page → Create Invoices

frappe.listview_settings['Purchase Invoice'] = {
    onload: function(listview) {
        listview.page.remove_inner_button('Smart Scan');
        var $btn = listview.page.add_button('Smart Scan', function() {
            show_zip_upload_dialog(listview);
        });
        $btn.removeClass('btn-default btn-secondary').css({
            'background-color':'#1a5ddb','border-color':'#1a5ddb','color':'#fff',
            'border-radius':'6px','padding':'5px 14px','font-weight':'500',
            'display':'inline-flex','align-items':'center','gap':'7px'
        }).html(`
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/>
                <line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/>
            </svg>
            <span>Smart Scan</span>
            <span style="background:#fff;color:#1a5ddb;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;">NEW</span>
        `);
    }
};

/* ══════════════════════════════════════════════════════════════════════════════
   INJECT ALL CSS ONCE
   ══════════════════════════════════════════════════════════════════════════════ */
function inject_bulk_css(){
    if(document.getElementById('ocr-bulk-all-css')) return;
    $('<style id="ocr-bulk-all-css">').text(`
/* ── Upload dialog ─────────────────────────────────────────────────── */
.ocr-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:9999;display:flex;align-items:center;justify-content:center}
.ocr-modal{background:#fff;border-radius:18px;padding:38px 36px 30px;width:580px;max-width:93vw;max-height:90vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,.25);position:relative;animation:ocr-pop .18s ease}
@keyframes ocr-pop{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
.ocr-x{position:absolute;top:20px;right:22px;font-size:22px;line-height:1;color:#9ca3af;background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:6px}
.ocr-x:hover{background:#f3f4f6;color:#374151}
.ocr-title{font-size:22px;font-weight:700;color:#0f172a;margin:0 0 5px}
.ocr-sub{font-size:14px;color:#94a3b8;margin:0 0 26px}
.ocr-drop{border:2px dashed #cbd5e1;border-radius:14px;padding:52px 24px 44px;text-align:center;cursor:pointer;transition:all .2s;background:#f8fafc;min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ocr-drop:hover,.ocr-drop.drag-over{border-color:#2563eb;background:#eff6ff}
.ocr-icon-wrap{width:72px;height:72px;border-radius:18px;background:#e8edf5;display:flex;align-items:center;justify-content:center;margin-bottom:18px}
.ocr-drop-label{font-size:17px;font-weight:700;color:#1e293b;margin:0 0 6px}
.ocr-drop-label a{color:#2563eb;text-decoration:underline;cursor:pointer}
.ocr-drop-hint{font-size:13px;color:#94a3b8;margin:0}
.ocr-file-card{display:flex;align-items:center;gap:12px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:13px 16px;text-align:left;width:100%;box-sizing:border-box}
.ocr-file-name{font-size:13.5px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:360px}
.ocr-file-size{font-size:12px;color:#94a3b8;margin-top:2px}
.ocr-file-rm{margin-left:auto;cursor:pointer;color:#94a3b8;background:none;border:none;font-size:20px;line-height:1;flex-shrink:0}
.ocr-file-rm:hover{color:#ef4444}
.ocr-warn{display:flex;align-items:flex-start;gap:11px;margin-top:20px;background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:15px 16px;font-size:13.5px;color:#92400e;line-height:1.55}
.ocr-warn svg{flex-shrink:0;margin-top:1px}
.ocr-warn strong{font-weight:700;color:#b45309}
.ocr-footer{display:flex;justify-content:space-between;align-items:center;margin-top:28px}
.ocr-btn-cancel{background:#fff;border:1.5px solid #d1d5db;border-radius:9px;padding:10px 26px;font-size:14.5px;font-weight:500;color:#374151;cursor:pointer}
.ocr-btn-cancel:hover{border-color:#9ca3af;background:#f9fafb}
.ocr-btn-primary{background:#1e3a8a;border:none;border-radius:9px;padding:11px 30px;font-size:14.5px;font-weight:600;color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:9px;transition:background .15s}
.ocr-btn-primary:hover:not(:disabled){background:#1e40af}
.ocr-btn-primary:disabled{opacity:.4;cursor:not-allowed}
.ocr-progress{margin-top:20px}
.ocr-progress-bar{width:100%;height:8px;background:#e2e8f0;border-radius:10px;overflow:hidden}
.ocr-progress-fill{height:100%;background:#2563eb;transition:width .4s ease;border-radius:10px}
.ocr-progress-text{font-size:13px;color:#64748b;margin-top:8px;text-align:center}

/* ── Review page ───────────────────────────────────────────────────── */
.bsr-page{position:fixed;inset:0;background:#f1f5f9;z-index:10000;overflow-y:auto;font-family:inherit}
.bsr-inner{max-width:1180px;margin:0 auto;padding:36px 40px 60px}
.bsr-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
.bsr-h1{font-size:26px;font-weight:800;color:#0f172a;margin:0 0 4px}
.bsr-h1-sub{font-size:14px;color:#94a3b8;margin:0}
.bsr-actions{display:flex;gap:12px;align-items:center}
.bsr-btn-cancel{background:#fff;border:1.5px solid #d1d5db;border-radius:9px;padding:10px 24px;font-size:14px;font-weight:500;color:#374151;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.bsr-btn-cancel:hover{border-color:#9ca3af;background:#f9fafb}
.bsr-btn-create{background:#1e3a8a;border:none;border-radius:9px;padding:11px 28px;font-size:14.5px;font-weight:700;color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:9px;transition:background .15s}
.bsr-btn-create:hover:not(:disabled){background:#1e40af}
.bsr-btn-create:disabled{opacity:.4;cursor:not-allowed}

/* Summary cards */
.bsr-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.bsr-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px}
.bsr-card-label{font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px}
.bsr-card-value{font-size:28px;font-weight:800;color:#0f172a;margin:0 0 2px}
.bsr-card-value.blue{color:#2563eb}
.bsr-card-value.amber{color:#d97706}
.bsr-card-hint{font-size:12px;color:#94a3b8;margin:0}

/* Warning banner */
.bsr-review-warn{display:flex;align-items:flex-start;gap:14px;background:#fffbeb;border:1.5px solid #fde68a;border-left:5px solid #f59e0b;border-radius:10px;padding:16px 20px;margin-bottom:24px}
.bsr-review-warn svg{flex-shrink:0;margin-top:2px}
.bsr-review-warn-title{font-size:15px;font-weight:700;color:#b45309;margin:0 0 3px}
.bsr-review-warn-desc{font-size:13px;color:#92400e;margin:0;line-height:1.55}

/* Table */
.bsr-table{width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;border-spacing:0}
.bsr-table th{background:#f8fafc;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;padding:14px 16px;text-align:left;border-bottom:1px solid #e2e8f0}
.bsr-table td{padding:14px 16px;font-size:13.5px;color:#1e293b;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.bsr-table tr:last-child td{border-bottom:none}
.bsr-table tr.failed td{color:#991b1b;background:#fef2f2}
.bsr-table tr.failed .bsr-supplier{color:#dc2626}
.bsr-table tr.failed .bsr-fname{color:#dc2626}

.bsr-supplier{font-weight:700;color:#0f172a;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bsr-fname{font-size:12px;color:#94a3b8;display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bsr-amount{font-weight:700;text-align:right}

/* Confidence badges */
.bsr-conf{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600}
.bsr-conf .dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.bsr-conf.high .dot{background:#16a34a} .bsr-conf.high{color:#16a34a}
.bsr-conf.medium .dot{background:#d97706} .bsr-conf.medium{color:#d97706}
.bsr-conf.low .dot{background:#dc2626} .bsr-conf.low{color:#dc2626}
.bsr-conf.failed .dot{background:#dc2626} .bsr-conf.failed{color:#dc2626}

/* Expand toggle */
.bsr-expand{background:#2563eb;border:none;border-radius:8px;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;color:#fff}
.bsr-expand:hover{background:#1d4ed8}
.bsr-expand.open{background:#2563eb;transform:rotate(180deg)}

/* Expanded detail row */
.bsr-detail-row td{padding:0 !important;background:#fff;border-bottom:1px solid #e2e8f0}
.bsr-detail-inner{padding:4px 20px 20px 88px}
.bsr-detail-table{width:100%;font-size:13px;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
.bsr-table .bsr-detail-table th{background:#f8fafc;padding:16px 20px;text-align:left;font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e2e8f0;border-top:none}
.bsr-table .bsr-detail-table th:last-child{text-align:right}
.bsr-table .bsr-detail-table td{padding:28px 20px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;background:#fff;vertical-align:middle}
.bsr-table .bsr-detail-table td:last-child{text-align:right;font-weight:600}
.bsr-table .bsr-detail-table tbody tr:last-child td{border-bottom:none}

/* Checkbox */
.bsr-cb{width:18px;height:18px;accent-color:#2563eb;cursor:pointer}

/* Creating overlay */
.bsr-creating{position:fixed;inset:0;background:#f1f5f9;z-index:10001;display:flex;align-items:center;justify-content:center}
.bsr-create-card{background:#fff;border-radius:18px;padding:48px 52px 40px;width:600px;max-width:92vw;box-shadow:0 8px 40px rgba(0,0,0,.08);text-align:center}
.bsr-create-spinner{width:72px;height:72px;border:5px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:ocr-spin .85s linear infinite;margin:0 auto 28px}
@keyframes ocr-spin{to{transform:rotate(360deg)}}
.bsr-create-title{font-size:22px;font-weight:800;color:#0f172a;margin:0 0 8px}
.bsr-create-sub{font-size:15px;color:#94a3b8;margin:0 0 32px}
.bsr-create-progress{width:100%;height:10px;background:#e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:12px}
.bsr-create-progress-fill{height:100%;background:#2563eb;border-radius:10px;transition:width .35s ease;width:0}
.bsr-create-counts{display:flex;justify-content:space-between;font-size:14px;color:#64748b;margin-bottom:28px}
.bsr-create-counts span:last-child{font-weight:700;color:#0f172a}
.bsr-activity-box{border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;text-align:left;max-height:240px;overflow-y:auto}
.bsr-activity-label{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin:0 0 14px}
.bsr-activity-item{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:14px;color:#1e293b}
.bsr-activity-item+.bsr-activity-item{border-top:1px solid #f1f5f9}
.bsr-activity-item .a-icon{flex-shrink:0;width:20px;text-align:center}
.bsr-activity-item .a-icon.ok{color:#16a34a}
.bsr-activity-item .a-icon.err{color:#dc2626}
.bsr-activity-item .a-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.bsr-activity-item .a-text.ok{color:#16a34a}
.bsr-activity-item .a-text.err{color:#dc2626}
.bsr-activity-item .a-time{flex-shrink:0;font-size:13px;color:#94a3b8;font-weight:500}

/* Results / Completion page */
.bsr-complete{position:fixed;inset:0;background:#f1f5f9;z-index:10001;overflow-y:auto;display:flex;align-items:center;justify-content:center}
.bsr-complete-card{background:#fff;border-radius:20px;width:620px;max-width:92vw;box-shadow:0 8px 40px rgba(0,0,0,.08);overflow:hidden}
.bsr-complete-hero{background:linear-gradient(135deg,#dbeafe 0%,#eff6ff 60%,#dbeafe 100%);padding:48px 40px 36px;text-align:center;position:relative;overflow:hidden}
.bsr-complete-hero::after{content:'';position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:rgba(191,219,254,.45);border-radius:50%}
.bsr-complete-check{width:72px;height:72px;background:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 22px;position:relative;z-index:1}
.bsr-complete-title{font-size:24px;font-weight:800;color:#0f172a;margin:0 0 6px;position:relative;z-index:1}
.bsr-complete-sub{font-size:15px;color:#64748b;margin:0;position:relative;z-index:1}
.bsr-complete-stats{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}
.bsr-complete-stat{padding:28px 20px;text-align:center}
.bsr-complete-stat+.bsr-complete-stat{border-left:1px solid #e2e8f0}
.bsr-complete-stat-val{font-size:32px;font-weight:800;margin:0 0 4px}
.bsr-complete-stat-val.blue{color:#2563eb}
.bsr-complete-stat-val.green{color:#16a34a}
.bsr-complete-stat-val.red{color:#dc2626}
.bsr-complete-stat-label{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;margin:0}
.bsr-complete-body{padding:24px 32px 32px}
.bsr-log-box{border:1.5px solid #e2e8f0;border-radius:14px;padding:18px 20px;display:flex;align-items:center;gap:16px;margin-bottom:28px}
.bsr-log-icon{width:44px;height:44px;background:#2563eb;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.bsr-log-info{flex:1;min-width:0}
.bsr-log-label{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;margin:0 0 3px}
.bsr-log-id{font-size:17px;font-weight:800;color:#2563eb;margin:0 0 2px}
.bsr-log-hint{font-size:12.5px;color:#94a3b8;margin:0}
.bsr-log-copy{background:#fff;border:1.5px solid #e2e8f0;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;color:#374151;cursor:pointer;display:inline-flex;align-items:center;gap:6px;flex-shrink:0}
.bsr-log-copy:hover{background:#f8fafc;border-color:#cbd5e1}
.bsr-complete-btns{display:flex;justify-content:center;gap:14px}
.bsr-btn-view{background:#1e3a8a;border:none;border-radius:10px;padding:13px 32px;font-size:15px;font-weight:700;color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:9px}
.bsr-btn-view:hover{background:#1e40af}
.bsr-btn-more{background:#fff;border:1.5px solid #d1d5db;border-radius:10px;padding:13px 32px;font-size:15px;font-weight:700;color:#374151;cursor:pointer;display:inline-flex;align-items:center;gap:9px}
.bsr-btn-more:hover{background:#f9fafb;border-color:#9ca3af}
    `).appendTo('head');
}

/* ══════════════════════════════════════════════════════════════════════════════
   STEP 1 — ZIP UPLOAD DIALOG
   ══════════════════════════════════════════════════════════════════════════════ */

function show_zip_upload_dialog(listview){
    inject_bulk_css();
    var selected_file = null;

    var $overlay = $(`
        <div class="ocr-overlay">
          <div class="ocr-modal">
            <button class="ocr-x" id="ocr-close">&times;</button>
            <h2 class="ocr-title">Bulk Upload Invoices</h2>
            <p class="ocr-sub">Upload a ZIP file containing invoice PDFs</p>
            <div class="ocr-drop" id="ocr-drop">
              <div id="ocr-empty">
                <div class="ocr-icon-wrap">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="12"/><line x1="15" y1="15" x2="12" y2="12"/>
                  </svg>
                </div>
                <p class="ocr-drop-label">Drag &amp; drop or <a id="ocr-browse">browse files</a></p>
                <p class="ocr-drop-hint">ZIP file containing PDFs &middot; Max 50 MB</p>
              </div>
              <div id="ocr-file-card" style="display:none" class="ocr-file-card">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <div style="min-width:0;flex:1"><div class="ocr-file-name" id="ocr-fname">—</div><div class="ocr-file-size" id="ocr-fsize"></div></div>
                <button class="ocr-file-rm" id="ocr-remove">&times;</button>
              </div>
            </div>
            <div class="ocr-warn">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span><strong>ZIP must contain only PDF files</strong> — one invoice per PDF. Nested folders inside the ZIP are supported. Non-PDF files will be skipped. Max 50 files per upload. Password-protected PDFs are not supported.</span>
            </div>
            <div class="ocr-progress" id="ocr-progress" style="display:none">
              <div class="ocr-progress-bar"><div class="ocr-progress-fill" id="ocr-progress-fill"></div></div>
              <p class="ocr-progress-text" id="ocr-progress-text">Starting...</p>
            </div>
            <div class="ocr-footer">
              <button class="ocr-btn-cancel" id="ocr-cancel">Cancel</button>
              <button class="ocr-btn-primary" id="ocr-extract" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Extract All
              </button>
            </div>
          </div>
        </div>
    `).appendTo('body');

    var $input = $('<input type="file" accept=".zip" style="display:none">').appendTo('body');

    function fmt_size(b){return b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB';}
    function set_file(f){
        if(!f)return;
        if(f.name.split('.').pop().toLowerCase()!=='zip'){frappe.show_alert({message:'Only ZIP files',indicator:'red'});return;}
        if(f.size>52428800){frappe.show_alert({message:'Max 50 MB',indicator:'red'});return;}
        selected_file=f;
        $overlay.find('#ocr-empty').hide();$overlay.find('#ocr-file-card').show();
        $overlay.find('#ocr-fname').text(f.name);$overlay.find('#ocr-fsize').text(fmt_size(f.size));
        $overlay.find('#ocr-extract').prop('disabled',false);
    }
    function clear_file(){selected_file=null;$input.val('');$overlay.find('#ocr-file-card').hide();$overlay.find('#ocr-empty').show();$overlay.find('#ocr-extract').prop('disabled',true);}
    function close_dlg(){$overlay.remove();$input.remove();}

    $overlay.find('#ocr-close,#ocr-cancel').on('click',close_dlg);
    $overlay.on('click',function(e){if($(e.target).hasClass('ocr-overlay'))close_dlg();});
    $overlay.find('#ocr-drop').on('click',function(e){if(!$(e.target).is('#ocr-remove')&&!$(e.target).closest('#ocr-remove').length)$input.trigger('click');});
    $overlay.find('#ocr-browse').on('click',function(e){e.stopPropagation();$input.trigger('click');});
    $input.on('change',function(){if(this.files&&this.files[0])set_file(this.files[0]);});
    $overlay.find('#ocr-remove').on('click',function(e){e.stopPropagation();clear_file();});
    $overlay.find('#ocr-drop')
        .on('dragover dragenter',function(e){e.preventDefault();e.stopPropagation();$(this).addClass('drag-over');})
        .on('dragleave',function(e){e.preventDefault();e.stopPropagation();$(this).removeClass('drag-over');})
        .on('drop',function(e){e.preventDefault();e.stopPropagation();$(this).removeClass('drag-over');if(e.originalEvent.dataTransfer.files[0])set_file(e.originalEvent.dataTransfer.files[0]);});

    /* ── Extract All click ────────────────────────────────────────────── */
    $overlay.find('#ocr-extract').on('click',function(){
        if(!selected_file)return;
        $overlay.find('#ocr-extract').prop('disabled',true).text('Processing...');
        $overlay.find('#ocr-cancel').prop('disabled',true);
        $overlay.find('#ocr-remove').hide();
        $overlay.find('#ocr-progress').show();
        $overlay.find('#ocr-progress-text').text('Uploading ZIP file...');
        $overlay.find('#ocr-progress-fill').css('width','15%');

        var fd=new FormData();
        fd.append('file',selected_file,selected_file.name);
        fd.append('is_private','1');fd.append('folder','Home/Attachments');

        fetch('/api/method/upload_file',{
            method:'POST',headers:{'X-Frappe-CSRF-Token':frappe.csrf_token},body:fd
        })
        .then(function(r){return r.json();})
        .then(function(resp){
            if(!resp.message||!resp.message.file_url){show_err('Upload failed');return;}
            $overlay.find('#ocr-progress-text').text('Extracting & scanning invoices...');
            $overlay.find('#ocr-progress-fill').css('width','40%');

            frappe.call({
                method:'ai_accountant.api.batch_invoice_extractor.extract_zip',
                args:{file_url:resp.message.file_url},
                timeout:300,
                callback:function(r){
                    if(!r||!r.message||!r.message.success){show_err((r&&r.message&&r.message.error)||'Extraction failed');return;}
                    $overlay.find('#ocr-progress-fill').css('width','100%');
                    $overlay.find('#ocr-progress-text').text('Done! Opening review...');
                    setTimeout(function(){
                        close_dlg();
                        show_review_page(r.message.results, selected_file.name, listview);
                    },500);
                },
                error:function(){show_err('Server error during extraction');}
            });
        })
        .catch(function(e){show_err('Upload error: '+(e.message||'Unknown'));});

        function show_err(msg){
            $overlay.find('#ocr-progress-fill').css({width:'100%',background:'#ef4444'});
            $overlay.find('#ocr-progress-text').css('color','#991b1b').text(msg);
            $overlay.find('#ocr-cancel').prop('disabled',false);
            $overlay.find('#ocr-extract').prop('disabled',false).text('Retry');
        }
    });
}


/* ══════════════════════════════════════════════════════════════════════════════
   STEP 2 — REVIEW PAGE
   ══════════════════════════════════════════════════════════════════════════════ */

function show_review_page(results, zip_name, listview){
    inject_bulk_css();

    // Separate success / failed
    var ok_rows  = results.filter(function(r){return r.success;});
    var err_rows = results.filter(function(r){return !r.success;});
    var all_rows = ok_rows.concat(err_rows);

    // Compute totals
    var combined_total = 0;
    ok_rows.forEach(function(r){ combined_total += (r.data && r.data.grand_total) || 0; });
    var needs_attention = err_rows.length + ok_rows.filter(function(r){return r.confidence !== 'high';}).length;

    function fmt_inr(n){
        var s = Math.round(n).toString();
        var lastThree = s.slice(-3);
        var rest = s.slice(0,-3);
        if(rest) lastThree = ',' + lastThree;
        return '₹' + rest.replace(/\B(?=(\d{2})+(?!\d))/g,',') + lastThree;
    }
    function fmt_date(d){
        if(!d)return '—';
        var p=d.split('-');return p.length===3?p[2]+'-'+p[1]+'-'+p[0]:d;
    }

    var $page = $(`
        <div class="bsr-page" id="bsr-page">
          <div class="bsr-inner">
            <div class="bsr-header">
              <div>
                <h1 class="bsr-h1">Review Extracted Invoices</h1>
                <p class="bsr-h1-sub">${results.length} invoices extracted from ${zip_name}</p>
              </div>
              <div class="bsr-actions">
                <button class="bsr-btn-cancel" id="bsr-cancel">✕ Cancel</button>
                <button class="bsr-btn-create" id="bsr-create" disabled>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span id="bsr-create-label">Create 0 Invoices</span>
                </button>
              </div>
            </div>

            <div class="bsr-cards">
              <div class="bsr-card"><p class="bsr-card-label">Total Extracted</p><p class="bsr-card-value">${results.length}</p><p class="bsr-card-hint">from ZIP file</p></div>
              <div class="bsr-card"><p class="bsr-card-label">Ready to Create</p><p class="bsr-card-value blue">${ok_rows.length}</p><p class="bsr-card-hint">high confidence</p></div>
              <div class="bsr-card"><p class="bsr-card-label">Needs Attention</p><p class="bsr-card-value amber">${needs_attention}</p><p class="bsr-card-hint">low confidence / error</p></div>
              <div class="bsr-card"><p class="bsr-card-label">Combined Total</p><p class="bsr-card-value">${fmt_inr(combined_total)}</p><p class="bsr-card-hint">across ${ok_rows.length} invoices</p></div>
            </div>

            <div class="bsr-review-warn">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div>
                <p class="bsr-review-warn-title">Review before creating</p>
                <p class="bsr-review-warn-desc">Expand each row to verify line items. Uncheck any invoice you want to exclude. Rows marked with warnings may have missing or low-confidence data — hover over the status for details.</p>
              </div>
            </div>

            <table class="bsr-table">
              <thead>
                <tr>
                  <th style="width:42px"><input type="checkbox" class="bsr-cb" id="bsr-select-all" checked></th>
                  <th style="width:46px"></th>
                  <th>File / Supplier</th>
                  <th>Bill No</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Confidence</th>
                  <th style="text-align:right">Amount</th>
                </tr>
              </thead>
              <tbody id="bsr-tbody"></tbody>
            </table>

            <div class="bsr-results" id="bsr-results" style="display:none"></div>
          </div>
        </div>
    `).appendTo('body');

    // ── Build table rows ─────────────────────────────────────────────────
    var $tbody = $page.find('#bsr-tbody');

    all_rows.forEach(function(row, idx){
        var is_ok      = row.success;
        var data       = row.data || {};
        var supplier   = data.supplier || '—';
        var bill_no    = data.bill_no || '—';
        var bill_date  = fmt_date(data.bill_date);
        var item_count = (data.items && data.items.length) ? data.items.length + ' items' : '—';
        var amount     = is_ok && data.grand_total ? fmt_inr(data.grand_total) : '—';
        var conf       = row.confidence || 'failed';
        var conf_label = conf.charAt(0).toUpperCase() + conf.slice(1);
        var cls        = is_ok ? '' : ' failed';
        var checked    = is_ok ? 'checked' : '';
        var error_hint = !is_ok ? row.error || 'Extraction failed' : '';

        // Main row
        var $tr = $(`
            <tr class="bsr-main-row${cls}" data-idx="${idx}">
              <td><input type="checkbox" class="bsr-cb bsr-row-cb" data-idx="${idx}" ${checked} ${!is_ok?'disabled':''}></td>
              <td>${is_ok?'<button class="bsr-expand" data-idx="'+idx+'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>':''}</td>
              <td>
                <span class="${is_ok?'bsr-supplier':'bsr-supplier'}" style="${!is_ok?'color:#dc2626':''}">${is_ok?supplier:row.filename}</span>
                <span class="bsr-fname" style="${!is_ok?'color:#f87171':''}">${is_ok?row.filename:error_hint}</span>
              </td>
              <td>${bill_no}</td>
              <td>${bill_date}</td>
              <td>${item_count}</td>
              <td><span class="bsr-conf ${conf}" title="${error_hint}"><span class="dot"></span> ${conf_label}</span></td>
              <td class="bsr-amount">${amount}</td>
            </tr>
        `);
        $tbody.append($tr);

        // Detail row (hidden)
        if(is_ok && data.items && data.items.length){
            var items_html = data.items.map(function(it, i){
                var qty_str = (it.qty||0) + (it.uom && it.uom!=='Nos' ? ' '+it.uom : '');
                return '<tr><td>'+(i+1)+'</td><td>'+(it.item_name||it.item_code||'—')+'</td><td>'+qty_str+'</td><td>'+fmt_inr(it.rate||0)+'</td><td>'+fmt_inr(it.amount||0)+'</td></tr>';
            }).join('');
            var $detail = $(`
                <tr class="bsr-detail-row" data-idx="${idx}" style="display:none">
                  <td colspan="8">
                    <div class="bsr-detail-inner">
                      <table class="bsr-detail-table">
                        <thead><tr>
                          <th style="width:60px">#</th>
                          <th>Item</th>
                          <th style="width:120px">Qty</th>
                          <th style="width:140px">Rate</th>
                          <th style="width:160px">Amount</th>
                        </tr></thead>
                        <tbody>${items_html}</tbody>
                      </table>
                    </div>
                  </td>
                </tr>
            `);
            $tbody.append($detail);
        }
    });

    // ── Interactions ─────────────────────────────────────────────────────
    function update_create_btn(){
        var count = $page.find('.bsr-row-cb:checked:not(:disabled)').length;
        $page.find('#bsr-create-label').text('Create ' + count + ' Invoice' + (count!==1?'s':''));
        $page.find('#bsr-create').prop('disabled', count===0);
    }
    update_create_btn();

    // Select all
    $page.find('#bsr-select-all').on('change',function(){
        var ch = $(this).is(':checked');
        $page.find('.bsr-row-cb:not(:disabled)').prop('checked',ch);
        update_create_btn();
    });

    // Individual checkbox
    $page.on('change','.bsr-row-cb',function(){ update_create_btn(); });

    // Expand/collapse
    $page.on('click','.bsr-expand',function(){
        var idx = $(this).data('idx');
        var $detail = $page.find('.bsr-detail-row[data-idx="'+idx+'"]');
        $(this).toggleClass('open');
        $detail.toggle();
    });

    // Cancel
    $page.find('#bsr-cancel').on('click',function(){
        $page.remove();
    });

    // ── Create Invoices (one-by-one with live progress) ─────────────────
    $page.find('#bsr-create').on('click',function(){
        var selected = [];
        $page.find('.bsr-row-cb:checked:not(:disabled)').each(function(){
            var idx = parseInt($(this).data('idx'));
            var row = all_rows[idx];
            if(row && row.success){
                selected.push({filename: row.filename, data: row.data});
            }
        });
        if(!selected.length) return;

        var total = selected.length;

        // Generate batch ID upfront so all invoices share the same ID
        var now = new Date();
        var batch_id = 'BSS-' + now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0') + String(now.getSeconds()).padStart(2,'0');

        // Show creating overlay
        var $creating = $(`
            <div class="bsr-creating" id="bsr-creating">
              <div class="bsr-create-card">
                <div class="bsr-create-spinner"></div>
                <p class="bsr-create-title">Creating invoices...</p>
                <p class="bsr-create-sub">Processing ${total} invoice${total>1?'s':''} as drafts. This may take a moment.</p>
                <div class="bsr-create-progress"><div class="bsr-create-progress-fill" id="bsr-cpf"></div></div>
                <div class="bsr-create-counts"><span>Processing...</span><span id="bsr-ccount">0 / ${total}</span></div>
                <div class="bsr-activity-box">
                  <p class="bsr-activity-label">Activity</p>
                  <div id="bsr-activity-list"></div>
                </div>
              </div>
            </div>
        `).appendTo($page);

        var created_results = [];
        var created_count = 0;
        var failed_count = 0;

        function process_one(index){
            if(index >= total){
                // All done
                $creating.find('.bsr-create-spinner').css({
                    'animation':'none','border-color':'#16a34a','border-top-color':'#16a34a'
                }).html('');
                $creating.find('.bsr-create-title').text('All done!');
                $creating.find('.bsr-create-sub').text(created_count + ' invoice'+(created_count!==1?'s':'')+' created as drafts.');
                $creating.find('.bsr-create-counts span:first').text('Complete');
                $creating.find('#bsr-cpf').css('width','100%');

                setTimeout(function(){
                    $creating.remove();
                    show_final_results($page, created_results, created_count, failed_count, total, listview, batch_id);
                }, 1200);
                return;
            }

            var entry = selected[index];
            var pct = Math.round(((index) / total) * 100);
            $creating.find('#bsr-cpf').css('width', pct + '%');
            $creating.find('#bsr-ccount').text((index) + ' / ' + total);

            var start_time = Date.now();

            frappe.call({
                method:'ai_accountant.api.batch_invoice_extractor.create_single_invoice',
                args:{ocr_data: JSON.stringify(entry.data), upload_log_id: batch_id},
                callback:function(r){
                    var elapsed = ((Date.now() - start_time)/1000).toFixed(1);
                    var res = r && r.message;

                    if(res && res.success){
                        created_count++;
                        created_results.push({filename: entry.filename, success:true, invoice: res.name, supplier: res.supplier});
                        add_activity($creating, true, (entry.data.supplier||entry.filename) + ' — ' + res.name, elapsed);
                    } else {
                        failed_count++;
                        var err = (res && res.error) || 'Failed';
                        created_results.push({filename: entry.filename, success:false, error: err});
                        add_activity($creating, false, entry.filename + ' — ' + err, elapsed);
                    }

                    $creating.find('#bsr-ccount').text((index+1) + ' / ' + total);
                    $creating.find('#bsr-cpf').css('width', Math.round(((index+1)/total)*100) + '%');
                    process_one(index + 1);
                },
                error:function(){
                    var elapsed = ((Date.now() - start_time)/1000).toFixed(1);
                    failed_count++;
                    created_results.push({filename: entry.filename, success:false, error:'Server error'});
                    add_activity($creating, false, entry.filename + ' — Server error', elapsed);
                    $creating.find('#bsr-ccount').text((index+1) + ' / ' + total);
                    process_one(index + 1);
                }
            });
        }

        process_one(0);
    });
}

function add_activity($creating, ok, text, time){
    var cls = ok ? 'ok' : 'err';
    var icon = ok ? '✓' : '✗';
    $creating.find('#bsr-activity-list').append(`
        <div class="bsr-activity-item">
          <span class="a-icon ${cls}">${icon}</span>
          <span class="a-text ${cls}">${text}</span>
          <span class="a-time">${time}s</span>
        </div>
    `);
    // Auto scroll to bottom
    var box = $creating.find('.bsr-activity-box')[0];
    if(box) box.scrollTop = box.scrollHeight;
}

function show_final_results($page, results, created, failed, total, listview, batch_id){
    // Collect created invoice names for filter
    var invoice_names = results.filter(function(r){return r.success;}).map(function(r){return r.invoice;});
    var skipped = total - created;

    // Remove the review page
    $page.remove();

    // Show completion overlay
    var $complete = $(`
        <div class="bsr-complete" id="bsr-complete">
          <div class="bsr-complete-card">
            <div class="bsr-complete-hero">
              <div class="bsr-complete-check">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p class="bsr-complete-title">Bulk upload complete</p>
              <p class="bsr-complete-sub">${created} invoice${created!==1?'s':''} created as drafts · ${skipped} skipped</p>
            </div>
            <div class="bsr-complete-stats">
              <div class="bsr-complete-stat">
                <p class="bsr-complete-stat-val blue">${total}</p>
                <p class="bsr-complete-stat-label">Processed</p>
              </div>
              <div class="bsr-complete-stat">
                <p class="bsr-complete-stat-val green">${created}</p>
                <p class="bsr-complete-stat-label">Created</p>
              </div>
              <div class="bsr-complete-stat">
                <p class="bsr-complete-stat-val red">${failed}</p>
                <p class="bsr-complete-stat-label">Failed</p>
              </div>
            </div>
            <div class="bsr-complete-body">
              <div class="bsr-log-box">
                <div class="bsr-log-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="14" y2="15"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
                </div>
                <div class="bsr-log-info">
                  <p class="bsr-log-label">Upload Log ID</p>
                  <p class="bsr-log-id">${batch_id}</p>
                  <p class="bsr-log-hint">Filter Purchase Invoices by this ID to find all entries from this upload</p>
                </div>
                <button class="bsr-log-copy" id="bsr-copy-id">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copy
                </button>
              </div>
              <div class="bsr-complete-btns">
                <button class="bsr-btn-view" id="bsr-view-inv">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  View Created Invoices
                </button>
                <button class="bsr-btn-more" id="bsr-upload-more">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Upload More
                </button>
              </div>
            </div>
          </div>
        </div>
    `).appendTo('body');

    // Copy batch ID
    $complete.find('#bsr-copy-id').on('click',function(){
        var $btn = $(this);
        // Reliable copy with fallback
        var copied = false;
        try {
            var ta = document.createElement('textarea');
            ta.value = batch_id;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            copied = document.execCommand('copy');
            document.body.removeChild(ta);
        } catch(e){}
        if(!copied && navigator.clipboard){
            navigator.clipboard.writeText(batch_id).catch(function(){});
            copied = true;
        }
        // Update button to Copied!
        $btn.html(`
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Copied!
        `).css({'color':'#16a34a','border-color':'#86efac','background':'#f0fdf4'});
    });

    // View created invoices — filter by upload_log_id
    $complete.find('#bsr-view-inv').on('click',function(){
        $complete.remove();
        window.location.href = '/app/purchase-invoice?upload_log_id=' + encodeURIComponent(batch_id);
    });

    // Upload more
    $complete.find('#bsr-upload-more').on('click',function(){
        $complete.remove();
        listview.refresh();
        setTimeout(function(){ show_zip_upload_dialog(listview); }, 300);
    });
}