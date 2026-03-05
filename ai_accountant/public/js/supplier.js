// Vendor Intelligence Dashboard — adds "Intelligence" tab to Supplier form

frappe.ui.form.on("Supplier", {
    refresh(frm) {
        if (!frm.is_new()) {
            console.log("[VI] Supplier refresh fired for:", frm.doc.name);
            setup_intelligence_tab(frm);
        }
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// TAB SETUP — inject an "Intelligence" tab into the Supplier form
// ══════════════════════════════════════════════════════════════════════════════

function setup_intelligence_tab(frm) {
    inject_vi_styles();

    // Don't duplicate
    if ($(frm.wrapper).find(".vi-tab-btn").length) {
        console.log("[VI] Tab already exists, skipping");
        return;
    }

    // ── Find the tab bar — try multiple selectors for v15 ──
    var $tabs = null;
    var selectors = [
        "ul#form-tabs",
        "ul.form-tabs",
        ".form-tabs .nav-tabs",
        "ul.nav-tabs"
    ];

    for (var i = 0; i < selectors.length; i++) {
        var $found = $(frm.wrapper).find(selectors[i]);
        if ($found.length) {
            $tabs = $found.first();
            console.log("[VI] Found tab bar with selector:", selectors[i], "children:", $tabs.children().length);
            break;
        }
    }

    if (!$tabs) {
        // Last resort — search entire page
        $tabs = $("ul#form-tabs, ul.form-tabs").first();
        if ($tabs.length) {
            console.log("[VI] Found tab bar via global selector");
        } else {
            console.log("[VI] ERROR: No tab bar found. Available elements:", 
                $(frm.wrapper).find("[class*=tab]").map(function(){ return this.className; }).get()
            );
            return;
        }
    }

    // Add Intelligence tab
    var $tab_li = $(`
        <li class="nav-item">
            <a class="nav-link vi-tab-btn" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                Intelligence
            </a>
        </li>
    `);
    $tabs.append($tab_li);
    console.log("[VI] Intelligence tab appended to tab bar");

    // Add content area
    var $vi_section = $(`<div id="vi-root" style="display:none;padding:24px 32px;min-height:400px;"></div>`);

    // Try to place it after form-layout
    var $form_layout = $(frm.wrapper).find(".form-layout");
    if ($form_layout.length) {
        $form_layout.after($vi_section);
        console.log("[VI] Content area added after .form-layout");
    } else {
        $(frm.wrapper).find(".layout-main-section").append($vi_section);
        console.log("[VI] Content area added to .layout-main-section");
    }

    // Intelligence tab click
    $tab_li.find(".vi-tab-btn").on("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log("[VI] Intelligence tab clicked");

        // Deactivate all Frappe tabs
        $tabs.find(".nav-link").removeClass("active");
        $(this).addClass("active");

        // Hide form layout
        $(frm.wrapper).find(".form-layout").hide();

        // Show intelligence
        $vi_section.show();

        // Load data on first click
        if (!frm.__vi_loaded) {
            $vi_section.html(`
                <div class="vi-loading">
                    <div class="vi-spinner"></div>
                    <p>Loading intelligence data...</p>
                </div>
            `);
            load_intelligence(frm);
        }
    });

    // When ANY native Frappe tab is clicked → restore form, hide intelligence
    $tabs.on("click", ".nav-link:not(.vi-tab-btn)", function () {
        console.log("[VI] Native tab clicked, restoring form");
        $vi_section.hide();
        $(frm.wrapper).find(".form-layout").show();
    });
}

function load_intelligence(frm) {
    frappe.call({
        method: "ai_accountant.api.vendor_intelligence.get_supplier_intelligence",
        args: { supplier: frm.doc.name },
        callback: function (r) {
            if (!r || !r.message || !r.message.success) {
                var err = (r && r.message && r.message.error) || "Unknown error";
                $("#vi-root").html('<p class="vi-error">Could not load data: ' + err + '</p>');
                return;
            }
            frm.__vi_loaded = true;
            render_dashboard(frm, r.message);
        },
        error: function () {
            $("#vi-root").html('<p class="vi-error">Server error loading intelligence data.</p>');
        }
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

function render_dashboard(frm, data) {
    var s = data.summary;
    var risk_count = s.risk_count || 0;
    var inv_count = data.invoices ? data.invoices.length : 0;
    var risk_cls = s.risk_level === "Low Risk" ? "green" : s.risk_level === "Medium Risk" ? "amber" : "red";

    var fmt_spend = format_inr(s.total_spend);
    var fmt_avg = format_inr(s.avg_invoice);

    // Price trend card
    var pt_html = "";
    if (s.price_trend) {
        var pt = s.price_trend;
        var arr = pt.pct_change >= 0 ? "↑" : "↓";
        var pc = pt.pct_change >= 0 ? "red" : "green";
        pt_html = `<p class="vi-card-value ${pc}">${arr} ${Math.abs(pt.pct_change)}%</p>
                    <p class="vi-card-hint">${pt.item_name} ₹${format_number(pt.earliest_rate)} → ₹${format_number(pt.latest_rate)}</p>`;
    } else {
        pt_html = `<p class="vi-card-value muted">—</p><p class="vi-card-hint">Not enough data</p>`;
    }

    // Payment days card
    var pay_html = "";
    if (s.avg_payment_days !== null && s.avg_payment_days !== undefined) {
        var pc2 = s.avg_payment_days <= 30 ? "green" : s.avg_payment_days <= 45 ? "amber" : "red";
        var ph = s.avg_payment_days <= 30 ? "early payer" : s.avg_payment_days <= 45 ? "on time" : "slow payer";
        pay_html = `<p class="vi-card-value ${pc2}">${s.avg_payment_days}</p><p class="vi-card-hint">vs 30-day terms (${ph})</p>`;
    } else {
        pay_html = `<p class="vi-card-value muted">—</p><p class="vi-card-hint">No payment data</p>`;
    }

    var sa = s.spend_change >= 0 ? "↑" : "↓";
    var shc = s.spend_change >= 0 ? "" : "green";

    var html = `
        <div class="vi-dashboard">
            <div class="vi-header">
                <div>
                    <h2 class="vi-supplier-name">${frm.doc.supplier_name || frm.doc.name}</h2>
                    <p class="vi-supplier-meta">${s.supplier_since ? "Supplier since " + s.supplier_since + " · " : ""}${s.total_invoices} invoice${s.total_invoices !== 1 ? "s" : ""}${s.risk_level === "Low Risk" ? " · Approved Vendor" : ""}</p>
                </div>
                <div class="vi-header-right">
                    <span class="vi-risk-badge ${risk_cls}">${s.risk_level}</span>
                    <button class="vi-export-btn" id="vi-export">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export Report
                    </button>
                </div>
            </div>
            <div class="vi-cards">
                <div class="vi-card">
                    <p class="vi-card-label">Total Spend (FY)</p>
                    <p class="vi-card-value blue">${fmt_spend}</p>
                    <p class="vi-card-hint ${shc}">${sa} ${Math.abs(s.spend_change)}% vs last FY</p>
                </div>
                <div class="vi-card">
                    <p class="vi-card-label">Avg Invoice</p>
                    <p class="vi-card-value">${fmt_avg}</p>
                    <p class="vi-card-hint">across ${s.invoice_count_fy} invoices this FY</p>
                </div>
                <div class="vi-card">
                    <p class="vi-card-label">Avg Payment Days</p>
                    ${pay_html}
                </div>
                <div class="vi-card">
                    <p class="vi-card-label">Price Trend</p>
                    ${pt_html}
                </div>
            </div>
            <div class="vi-inner-tabs">
                <button class="vi-itab active" data-tab="spend">Spend Trend</button>
                <button class="vi-itab" data-tab="price">Price History</button>
                <button class="vi-itab" data-tab="risk">Risk Flags <span class="vi-itab-badge ${risk_count > 0 ? "show" : ""}">${risk_count}</span></button>
                <button class="vi-itab" data-tab="invoices">Invoices <span class="vi-itab-count">${inv_count}</span></button>
            </div>
            <div class="vi-itab-content" id="vi-itab-spend"></div>
            <div class="vi-itab-content" id="vi-itab-price" style="display:none"></div>
            <div class="vi-itab-content" id="vi-itab-risk" style="display:none"></div>
            <div class="vi-itab-content" id="vi-itab-invoices" style="display:none"></div>
        </div>`;

    $("#vi-root").html(html);
    render_spend_chart(data.spend_trend);
    render_price_history(data.price_history);
    render_risk_flags(data.risk_flags);
    render_invoices(data.invoices);

    $(".vi-itab").on("click", function () {
        var tab = $(this).data("tab");
        $(".vi-itab").removeClass("active");
        $(this).addClass("active");
        $(".vi-itab-content").hide();
        $("#vi-itab-" + tab).show();
    });

    $("#vi-export").on("click", function () {
        window.open("/printview?doctype=Supplier&name=" + encodeURIComponent(frm.doc.name), "_blank");
    });
}

// ── Spend Trend Chart (pure CSS bars) ────────────────────────────────────────

function render_spend_chart(spend_data) {
    if (!spend_data || !spend_data.length) {
        $("#vi-itab-spend").html('<p class="vi-empty">No spend data available</p>');
        return;
    }
    var mx = Math.max.apply(null, spend_data.map(function(d){return d.total;}));
    if (mx===0) mx=1;
    var cm = new Date().toISOString().slice(0,7);

    var bars = spend_data.map(function(d){
        var pct = Math.round((d.total/mx)*100);
        var vl;
        if(d.total>=100000) vl=(d.total/100000).toFixed(1);
        else if(d.total>=1000) vl=(d.total/1000).toFixed(0)+"K";
        else vl=d.total>0?Math.round(d.total):"0";
        return `<div class="vi-bar-col">
            <span class="vi-bar-val">${vl}</span>
            <div class="vi-bar ${d.month===cm?"current":""}" style="height:${Math.max(pct,3)}%"></div>
            <span class="vi-bar-label">${d.label}</span>
        </div>`;
    }).join("");

    $("#vi-itab-spend").html(`
        <div class="vi-chart-box">
            <p class="vi-chart-title">Monthly Spend — Last 12 Months (₹ Lakhs)</p>
            <div class="vi-bar-chart">${bars}</div>
        </div>`);
}

// ── Price History ────────────────────────────────────────────────────────────

function render_price_history(price_data) {
    if (!price_data || !price_data.length) {
        $("#vi-itab-price").html('<p class="vi-empty">No price history available</p>');
        return;
    }

    var rows = price_data.map(function(item){
        var arr = item.change_pct>=0?"↑":"↓";
        var cls = item.change_pct>0?"red":item.change_pct<0?"green":"muted";
        var cnt = item.history?item.history.length:0;

        // Mini sparkline
        var spark = "";
        if(item.history && item.history.length>=2){
            var pts=item.history.slice(-6);
            var rates=pts.map(function(p){return p.rate;});
            var mn=Math.min.apply(null,rates), mxr=Math.max.apply(null,rates), rng=mxr-mn||1;
            var points=pts.map(function(p,i){
                return (i/(pts.length-1))*80+","+(24-((p.rate-mn)/rng)*20);
            }).join(" ");
            spark=`<svg width="80" height="28" class="vi-spark"><polyline points="${points}" fill="none" stroke="${item.change_pct>=0?'#ef4444':'#16a34a'}" stroke-width="2"/></svg>`;
        }

        return `<tr class="vi-price-row" data-item="${item.item_code}">
            <td class="vi-td-item"><span class="vi-item-name">${item.item_name||item.item_code}</span><span class="vi-item-code">${item.item_code}</span></td>
            <td class="vi-td-rate">₹${format_number(item.latest_rate)}</td>
            <td class="vi-td-change ${cls}">${arr} ${Math.abs(item.change_pct)}%</td>
            <td class="vi-td-spark">${spark}</td>
            <td class="vi-td-count">${cnt} invoice${cnt!==1?"s":""}</td>
        </tr>`;
    }).join("");

    $("#vi-itab-price").html(`<div class="vi-price-box"><table class="vi-price-table">
        <thead><tr><th>Item</th><th>Latest Rate</th><th>Change</th><th>Trend</th><th>Data Points</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`);

    // Expandable detail
    $(".vi-price-row").on("click", function(){
        var code=$(this).data("item");
        var item=price_data.find(function(p){return p.item_code===code;});
        if(!item) return;
        var $nx=$(this).next(".vi-price-detail");
        if($nx.length){$nx.remove();return;}
        $(".vi-price-detail").remove();
        var det=(item.history||[]).map(function(h){
            return `<tr><td>${h.date}</td><td>₹${format_number(h.rate)}</td><td>${h.qty} ${h.uom||""}</td><td><a href="/app/purchase-invoice/${h.invoice}" target="_blank">${h.invoice}</a></td></tr>`;
        }).join("");
        $(this).after(`<tr class="vi-price-detail"><td colspan="5"><table class="vi-detail-table">
            <thead><tr><th>Date</th><th>Rate</th><th>Qty</th><th>Invoice</th></tr></thead>
            <tbody>${det}</tbody></table></td></tr>`);
    });
}

// ── Risk Flags ───────────────────────────────────────────────────────────────

function render_risk_flags(flags) {
    if (!flags || !flags.length) {
        $("#vi-itab-risk").html(`<div class="vi-empty-state">
            <div class="vi-empty-icon green">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <p class="vi-empty-title">No risk flags</p>
            <p class="vi-empty-desc">This supplier has passed all automated audit checks.</p>
        </div>`);
        return;
    }
    var html = flags.map(function(f){
        var sc = f.severity==="high"?"red":f.severity==="medium"?"amber":"blue";
        var ic = f.severity==="high"?"⚠":f.severity==="medium"?"⚡":"ℹ";
        return `<div class="vi-flag ${sc}">
            <span class="vi-flag-icon">${ic}</span>
            <div class="vi-flag-body"><p class="vi-flag-title">${f.title}</p><p class="vi-flag-detail">${f.detail}</p></div>
            <span class="vi-flag-severity">${f.severity.toUpperCase()}</span>
        </div>`;
    }).join("");
    $("#vi-itab-risk").html(`<div class="vi-flags-box">${html}</div>`);
}

// ── Invoices Table ───────────────────────────────────────────────────────────

function render_invoices(invoices) {
    if (!invoices || !invoices.length) {
        $("#vi-itab-invoices").html('<p class="vi-empty">No invoices found</p>');
        return;
    }
    var rows = invoices.map(function(inv){
        var sc = inv.status==="Paid"?"green":inv.status==="Overdue"?"red":"blue";
        return `<tr>
            <td><a href="/app/purchase-invoice/${inv.name}" target="_blank" class="vi-inv-link">${inv.name}</a></td>
            <td>${inv.posting_date}</td><td>${inv.bill_no||"—"}</td>
            <td class="vi-td-amount">₹${format_number(inv.grand_total)}</td>
            <td class="vi-td-amount">₹${format_number(inv.outstanding_amount)}</td>
            <td><span class="vi-status ${sc}">${inv.status}</span></td>
        </tr>`;
    }).join("");

    $("#vi-itab-invoices").html(`<div class="vi-inv-box"><table class="vi-inv-table">
        <thead><tr><th>Invoice</th><th>Date</th><th>Bill No</th><th>Amount</th><th>Outstanding</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`);
}

// ── Formatters ───────────────────────────────────────────────────────────────

function format_inr(val) {
    if (!val) return "₹0";
    if (val >= 10000000) return "₹" + (val / 10000000).toFixed(1) + "Cr";
    if (val >= 100000) return "₹" + (val / 100000).toFixed(1) + "L";
    if (val >= 1000) return "₹" + (val / 1000).toFixed(1) + "K";
    return "₹" + Math.round(val);
}

function format_number(val) {
    if (!val && val !== 0) return "0";
    return Number(val).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════

function inject_vi_styles() {
    if (document.getElementById("vi-css")) return;
    $("<style id='vi-css'>").text(`

.vi-loading{text-align:center;padding:80px 20px;color:#94a3b8}
.vi-spinner{width:40px;height:40px;border:4px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:vi-spin .8s linear infinite;margin:0 auto 16px}
@keyframes vi-spin{to{transform:rotate(360deg)}}
.vi-error{text-align:center;padding:60px 20px;color:#ef4444;font-size:15px}
.vi-empty{text-align:center;padding:60px 20px;color:#94a3b8;font-size:15px}

.vi-dashboard{max-width:1200px;padding:0}

.vi-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;flex-wrap:wrap;gap:16px}
.vi-supplier-name{font-size:22px;font-weight:800;color:#0f172a;margin:0 0 4px}
.vi-supplier-meta{font-size:13.5px;color:#94a3b8;margin:0}
.vi-header-right{display:flex;align-items:center;gap:12px;flex-shrink:0}
.vi-risk-badge{font-size:13px;font-weight:700;padding:5px 16px;border-radius:20px;letter-spacing:.3px}
.vi-risk-badge.green{background:#dcfce7;color:#16a34a;border:1px solid #86efac}
.vi-risk-badge.amber{background:#fef3c7;color:#d97706;border:1px solid #fde68a}
.vi-risk-badge.red{background:#fee2e2;color:#dc2626;border:1px solid #fca5a5}
.vi-export-btn{background:#fff;border:1.5px solid #d1d5db;border-radius:9px;padding:7px 18px;font-size:13.5px;font-weight:600;color:#374151;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.vi-export-btn:hover{background:#f9fafb;border-color:#9ca3af}

.vi-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}
@media(max-width:900px){.vi-cards{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.vi-cards{grid-template-columns:1fr}}
.vi-card{border:1.5px solid #e2e8f0;border-radius:14px;padding:22px 24px;background:#fff}
.vi-card-label{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin:0 0 10px}
.vi-card-value{font-size:28px;font-weight:800;color:#0f172a;margin:0 0 4px;line-height:1.1}
.vi-card-value.blue{color:#2563eb}
.vi-card-value.green{color:#16a34a}
.vi-card-value.red{color:#ef4444}
.vi-card-value.amber{color:#d97706}
.vi-card-value.muted{color:#cbd5e1}
.vi-card-hint{font-size:12.5px;color:#94a3b8;margin:0}
.vi-card-hint.green{color:#16a34a}

.vi-inner-tabs{display:flex;gap:0;border-bottom:2px solid #e2e8f0;margin-bottom:0}
.vi-itab{background:none;border:none;padding:12px 22px;font-size:14px;font-weight:600;color:#94a3b8;cursor:pointer;border-bottom:2.5px solid transparent;margin-bottom:-2px;transition:all .15s;display:inline-flex;align-items:center;gap:6px}
.vi-itab:hover{color:#475569}
.vi-itab.active{color:#2563eb;border-bottom-color:#2563eb}
.vi-itab-badge{font-size:11px;font-weight:700;background:#e2e8f0;color:#64748b;padding:1px 8px;border-radius:20px;display:none}
.vi-itab-badge.show{display:inline}
.vi-itab.active .vi-itab-badge.show{background:#dbeafe;color:#2563eb}
.vi-itab-count{font-size:12px;color:#94a3b8;font-weight:400}

.vi-itab-content{padding:24px 0}

.vi-chart-box{border:1.5px solid #e2e8f0;border-radius:14px;padding:28px 28px 20px;background:#fff}
.vi-chart-title{font-size:14px;font-weight:600;color:#475569;margin:0 0 24px}
.vi-bar-chart{display:flex;align-items:flex-end;gap:0;height:200px;padding:0 8px}
.vi-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;min-width:0}
.vi-bar-val{font-size:11px;font-weight:600;color:#64748b;margin-bottom:6px}
.vi-bar{width:60%;max-width:48px;background:#dbeafe;border-radius:6px 6px 0 0;transition:height .4s ease;min-height:3px}
.vi-bar.current{background:#2563eb}
.vi-bar-label{font-size:11.5px;color:#94a3b8;margin-top:10px;font-weight:500}

.vi-price-box{border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff}
.vi-price-table{width:100%;border-collapse:collapse}
.vi-price-table th{background:#f8fafc;padding:14px 20px;text-align:left;font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e2e8f0}
.vi-price-table td{padding:18px 20px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b}
.vi-price-row{cursor:pointer;transition:background .15s}
.vi-price-row:hover{background:#f8fafc}
.vi-td-item{min-width:180px}
.vi-item-name{display:block;font-weight:600;color:#0f172a;font-size:14px}
.vi-item-code{display:block;font-size:11.5px;color:#94a3b8;margin-top:2px}
.vi-td-rate{font-weight:700;font-size:15px}
.vi-td-change{font-weight:700;font-size:14px}
.vi-td-change.red{color:#ef4444}
.vi-td-change.green{color:#16a34a}
.vi-td-change.muted{color:#cbd5e1}
.vi-td-spark{padding:8px 12px}
.vi-spark{display:block}
.vi-td-count{color:#94a3b8;font-size:13px}

.vi-price-detail td{padding:0 20px 16px 20px;background:#f8fafc}
.vi-detail-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
.vi-detail-table th{background:#f1f5f9;padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;text-align:left;border-bottom:1px solid #e2e8f0}
.vi-detail-table td{padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#475569}
.vi-detail-table a{color:#2563eb;text-decoration:none;font-weight:600}
.vi-detail-table a:hover{text-decoration:underline}

.vi-flags-box{display:flex;flex-direction:column;gap:12px}
.vi-flag{display:flex;align-items:flex-start;gap:14px;padding:18px 22px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff}
.vi-flag.red{border-left:4px solid #ef4444;background:#fef2f2}
.vi-flag.amber{border-left:4px solid #f59e0b;background:#fffbeb}
.vi-flag.blue{border-left:4px solid #3b82f6;background:#eff6ff}
.vi-flag-icon{font-size:20px;flex-shrink:0;margin-top:1px}
.vi-flag-body{flex:1;min-width:0}
.vi-flag-title{font-size:15px;font-weight:700;color:#0f172a;margin:0 0 4px}
.vi-flag-detail{font-size:13px;color:#64748b;margin:0;line-height:1.5}
.vi-flag-severity{font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;flex-shrink:0;letter-spacing:.5px}
.vi-flag.red .vi-flag-severity{background:#fee2e2;color:#dc2626}
.vi-flag.amber .vi-flag-severity{background:#fef3c7;color:#d97706}
.vi-flag.blue .vi-flag-severity{background:#dbeafe;color:#2563eb}

.vi-empty-state{text-align:center;padding:60px 20px}
.vi-empty-icon{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 18px}
.vi-empty-icon.green{background:#dcfce7}
.vi-empty-title{font-size:17px;font-weight:700;color:#0f172a;margin:0 0 6px}
.vi-empty-desc{font-size:14px;color:#94a3b8;margin:0}

.vi-inv-box{border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff}
.vi-inv-table{width:100%;border-collapse:collapse}
.vi-inv-table th{background:#f8fafc;padding:14px 20px;text-align:left;font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e2e8f0}
.vi-inv-table td{padding:16px 20px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b}
.vi-inv-link{color:#2563eb;font-weight:600;text-decoration:none}
.vi-inv-link:hover{text-decoration:underline}
.vi-td-amount{font-weight:600;text-align:right;font-variant-numeric:tabular-nums}
.vi-inv-table th:nth-child(4),.vi-inv-table th:nth-child(5){text-align:right}
.vi-status{font-size:11.5px;font-weight:700;padding:3px 12px;border-radius:20px;display:inline-block}
.vi-status.green{background:#dcfce7;color:#16a34a}
.vi-status.red{background:#fee2e2;color:#dc2626}
.vi-status.blue{background:#dbeafe;color:#2563eb}

.vi-tab-btn.active{color:#2563eb !important}

    `).appendTo("head");
}