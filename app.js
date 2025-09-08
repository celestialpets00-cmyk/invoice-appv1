// ====== Heavy Metal Medics — Invoice App (GST 5% + Presets) ======
const $ = (id) => document.getElementById(id);
const LOGO_SRC = "icons/icon-192.png";

const state = {
  items: [],
  invoices: JSON.parse(localStorage.getItem("invoices.v1") || "[]"),
  presets: JSON.parse(localStorage.getItem("presets.v1") || "null") || [
    { label: "Labour", price: 110, qty: 1 },
    { label: "Travel", price: 110, qty: 1 }
  ],
  GST_RATE: 5 // fixed GST %
};

// ---------- Helpers ----------
function money(n) {
  const c = $("currency").value || "$";
  return c + Number(n || 0).toFixed(2);
}
function escapeHtml(s) {
  return (s || "").replace(/[&<>\"']/g, (m) => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[m]
  ));
}
function nl2br(s) { return (s || "").replace(/\n/g, "<br>"); }

// ---------- Items ----------
function addItem(i = null) {
  const idx = state.items.length;
  const item = i || { description: "", qty: 1, price: 0 };
  state.items.push(item);

  const wrap = document.createElement("div");
  wrap.className = "item";
  wrap.dataset.index = idx;
  wrap.innerHTML = `
    <label>Description<input placeholder="Service / Part" value="${item.description}"></label>
    <label>Qty<input type="number" step="0.01" value="${item.qty}"></label>
    <label>Price<input type="number" step="0.01" value="${item.price}"></label>
    <button class="remove">Remove</button>
  `;

  wrap.querySelectorAll("input")[0].addEventListener("input", (e) => { item.description = e.target.value; render(); });
  wrap.querySelectorAll("input")[1].addEventListener("input", (e) => { item.qty = parseFloat(e.target.value || 0); render(); });
  wrap.querySelectorAll("input")[2].addEventListener("input", (e) => { item.price = parseFloat(e.target.value || 0); render(); });

  wrap.querySelector(".remove").addEventListener("click", () => {
    const i = parseInt(wrap.dataset.index, 10);
    state.items.splice(i, 1);
    document.querySelector("#items").innerHTML = "";
    const copy = [...state.items]; state.items.length = 0;
    copy.forEach(addItem);
    render();
  });

  document.querySelector("#items").appendChild(wrap);
  render();
}

// ---------- Presets ----------
function savePresets() {
  localStorage.setItem("presets.v1", JSON.stringify(state.presets));
}
function renderPresetButtons() {
  const holder = $("presetButtons");
  if (!holder) return;
  holder.innerHTML = "";

  state.presets.forEach((p, idx) => {
    const btn = document.createElement("button");
    btn.className = "secondary";
    btn.textContent = `+ ${p.label} ${money(p.price)}${p.qty !== 1 ? " ×" + p.qty : ""}`;
    btn.style.position = "relative";
    btn.addEventListener("click", () => addItem({ description: p.label, qty: p.qty, price: p.price }));

    // tiny delete control
    const del = document.createElement("span");
    del.textContent = "×";
    del.title = "Remove preset";
    del.style.cssText = "position:absolute;top:-6px;right:-6px;background:#f8d7da;color:#a33;border:1px solid #a33;border-radius:10px;padding:0 6px;cursor:pointer;font-size:12px;line-height:18px;";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`Remove preset "${p.label}"?`)) {
        state.presets.splice(idx, 1);
        savePresets();
        renderPresetButtons();
      }
    });

    const wrap = document.createElement("div");
    wrap.style.position = "relative";
    wrap.appendChild(btn);
    wrap.appendChild(del);
    holder.appendChild(wrap);
  });
}
function wirePresetForm() {
  const addBtn = $("addPresetBtn");
  if (!addBtn) return;
  addBtn.addEventListener("click", () => {
    const name = ($("presetName").value || "").trim();
    const price = parseFloat($("presetPrice").value || 0);
    const qty = parseFloat($("presetQty").value || 1);
    if (!name) { alert("Please enter a label."); return; }
    if (isNaN(price)) { alert("Please enter a price."); return; }
    if (isNaN(qty)) { alert("Please enter a quantity."); return; }

    state.presets.push({ label: name, price, qty });
    savePresets();
    renderPresetButtons();

    $("presetName").value = "";
    $("presetPrice").value = "110";
    $("presetQty").value = "1";
  });
}

// ---------- Totals ----------
function calcTotals() {
  const subtotal = state.items.reduce((s, it) => s + (it.qty * it.price), 0);
  const discRate = parseFloat($("discountRate").value || 0) / 100;
  const gstRate  = state.GST_RATE / 100;
  const discount = subtotal * discRate;
  const taxable  = Math.max(0, subtotal - discount);
  const tax      = taxable * gstRate;
  const total    = taxable + tax;
  return { subtotal, discount, tax, total };
}

// ---------- Invoice data ----------
function currentInvoice() {
  return {
    business: {
      name: $("bizName").value || "Heavy Metal Medics",
      email: $("bizEmail").value,
      phone: $("bizPhone").value,
      addr:  $("bizAddr").value,
      logo:  LOGO_SRC
    },
    invoice: {
      number: $("invNumber").value,
      date: $("invDate").value,
      due:  $("dueDate").value,
      currency: $("currency").value,
      taxRate: state.GST_RATE,         // fixed 5
      discountRate: $("discountRate").value,
      notes: $("notes").value,
      terms: $("terms").value
    },
    client: {
      name: $("clientName").value,
      email: $("clientEmail").value,
      phone: $("clientPhone").value,
      addr:  $("clientAddr").value
    },
    items: state.items
  };
}

function setInvoice(data) {
  $("bizName").value   = data.business?.name  ?? "Heavy Metal Medics";
  $("bizEmail").value  = data.business?.email ?? "";
  $("bizPhone").value  = data.business?.phone ?? "";
  $("bizAddr").value   = data.business?.addr  ?? "";

  $("invNumber").value = data.invoice?.number ?? "";
  $("invDate").value   = data.invoice?.date   ?? "";
  $("dueDate").value   = data.invoice?.due    ?? "";
  $("currency").value  = data.invoice?.currency ?? "$";

  $("taxRate").value = String(state.GST_RATE);
  $("taxRate").setAttribute("disabled", "disabled");

  $("discountRate").value = data.invoice?.discountRate ?? 0;
  $("notes").value     = data.invoice?.notes ?? "";
  $("terms").value     = data.invoice?.terms ?? "";

  $("clientName").value  = data.client?.name ?? "";
  $("clientEmail").value = data.client?.email ?? "";
  $("clientPhone").value = data.client?.phone ?? "";
  $("clientAddr").value  = data.client?.addr ?? "";

  document.querySelector("#items").innerHTML = "";
  state.items = [];
  (data.items || []).forEach(addItem);

  render();
}

// ---------- Render ----------
function render() {
  const { subtotal, discount, tax, total } = calcTotals();
  $("subtotal").textContent   = money(subtotal);
  $("discount").textContent   = money(discount);
  $("tax").textContent        = money(tax);
  $("grandTotal").textContent = money(total);

  const inv = currentInvoice();
  localStorage.setItem("lastBiz.v1", JSON.stringify(inv.business));

  const logoImg = inv.business.logo ? `<img class="logo" src="${inv.business.logo}" alt="logo">` : "";
  const dateStr = inv.invoice.date || new Date().toISOString().slice(0, 10);

  const rows = inv.items.map((it, i) => `
    <tr>
      <td>${i + 1}. ${escapeHtml(it.description || "")}</td>
      <td>${Number(it.qty || 0)}</td>
      <td>${money(it.price || 0)}</td>
      <td>${money((it.qty || 0) * (it.price || 0))}</td>
    </tr>
  `).join("");

  document.getElementById("preview").innerHTML = `
    <div id="previewDoc">
      <div class="header">
        <div>
          <h1 style="margin:0">INVOICE</h1>
          <div class="muted"># ${escapeHtml(inv.invoice.number || "")}</div>
        </div>
        <div>${logoImg}</div>
      </div>

      <div style="display:flex;gap:20px;justify-content:space-between;align-items:flex-start;border-top:4px solid #2e7d32;padding-top:8px">
        <div>
          <strong>${escapeHtml(inv.business.name || "")}</strong><br>
          ${nl2br(escapeHtml(inv.business.addr || ""))}<br>
          ${escapeHtml(inv.business.email || "")} ${escapeHtml(inv.business.phone || "")}
        </div>
        <div>
          <div><strong>Date:</strong> ${escapeHtml(dateStr)}</div>
          <div><strong>Due:</strong> ${escapeHtml(inv.invoice.due || "")}</div>
        </div>
      </div>

      <div style="margin-top:10px;display:flex;gap:20px;">
        <div>
          <strong style="color:#2e7d32">Bill To:</strong><br>
          ${escapeHtml(inv.client.name || "")}<br>
          ${nl2br(escapeHtml(inv.client.addr || ""))}<br>
          ${escapeHtml(inv.client.email || "")} ${escapeHtml(inv.client.phone || "")}
        </div>
      </div>

      <table>
        <thead style="background:#eaf4ec">
          <tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4" class="muted">No items yet</td></tr>'}</tbody>
        <tfoot>
          <tr><td colspan="3" style="text-align:right">Subtotal</td><td>${money(subtotal)}</td></tr>
          <tr><td colspan="3" style="text-align:right">Discount (${Number(inv.invoice.discountRate || 0)}%)</td><td>${money(discount)}</td></tr>
          <tr><td colspan="3" style="text-align:right">GST (${state.GST_RATE}%)</td><td>${money(tax)}</td></tr>
          <tr><td colspan="3" style="text-align:right;color:#2e7d32"><strong>Total</strong></td><td style="color:#2e7d32"><strong>${money(total)}</strong></td></tr>
        </tfoot>
      </table>

      ${inv.invoice.notes ? `<div style="margin-top:10px"><strong>Notes:</strong><br>${nl2br(escapeHtml(inv.invoice.notes))}</div>` : ""}
      ${inv.invoice.terms ? `<div style="margin-top:10px"><strong>Terms:</strong><br>${nl2br(escapeHtml(inv.invoice.terms))}</div>` : ""}

      <!-- Footer watermark -->
      <div style="margin-top:30px;text-align:center;font-size:12px;color:#2e7d32;opacity:0.8;border-top:1px solid #ccc;padding-top:8px">
        Heavy Metal Medics — Agricultural Equipment Specialists
      </div>
    </div>
  `;
}

// ---------- Save / Load / New ----------
function saveInvoice() {
  const inv = currentInvoice();
  if (!inv.invoice.number) { alert("Please set an Invoice # first."); return; }
  const i = state.invoices.findIndex(x => x.invoice.number === inv.invoice.number);
  if (i >= 0) state.invoices[i] = inv;
  else state.invoices.unshift(inv);
  localStorage.setItem("invoices.v1", JSON.stringify(state.invoices));
  alert("Saved locally.");
}

function loadInvoice() {
  if (state.invoices.length === 0) { alert("No saved invoices yet."); return; }
  const choices = state.invoices.map((x, i) => `${i + 1}. ${x.invoice.number} — ${x.client.name || ""}`).join("\n");
  const pick = prompt("Choose invoice to load:\n" + choices + "\nEnter number:");
  const idx = (parseInt(pick, 10) || 0) - 1;
  if (idx >= 0 && idx < state.invoices.length) setInvoice(state.invoices[idx]);
}

function newInvoice() {
  const biz = JSON.parse(localStorage.getItem("lastBiz.v1") || "{}");
  setInvoice({
    business: {
      name: biz.name || "Heavy Metal Medics",
      email: biz.email || "",
      phone: biz.phone || "",
      addr:  biz.addr || "",
      logo:  LOGO_SRC
    },
    invoice: {
      number: "INV-" + Date.now().toString().slice(0, 6),
      date: new Date().toISOString().slice(0, 10),
      due: "",
      currency: "$",
      taxRate: state.GST_RATE,
      discountRate: 0,
      notes: "",
      terms: ""
    },
    client: {},
    items: []
  });
}

// ---------- Backup / Restore ----------
function exportJson() {
  const blob = new Blob([JSON.stringify({ invoices: state.invoices }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "invoices_backup.json"; a.click();
  URL.revokeObjectURL(url);
}

function importJson(e) {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data)) state.invoices = data;
      else if (Array.isArray(data.invoices)) state.invoices = data.invoices;
      localStorage.setItem("invoices.v1", JSON.stringify(state.invoices));
      alert("Imported.");
    } catch {
      alert("Invalid JSON");
    }
  };
  reader.readAsText(f);
}

// ---------- Init ----------
window.addEventListener("load", () => {
  const today = new Date().toISOString().slice(0, 10);
  $("invDate").value = today;
  $("invNumber").value = "INV-" + Date.now().toString().slice(0, 6);

  // Enforce GST 5%
  $("taxRate").value = String(state.GST_RATE);
  $("taxRate").setAttribute("disabled", "disabled");

  $("addItemBtn").addEventListener("click", () => addItem());

  // Presets UI
  renderPresetButtons();
  wirePresetForm();

  $("saveInvoiceBtn").addEventListener("click", saveInvoice);
  $("loadInvoiceBtn").addEventListener("click", loadInvoice);
  $("newInvoiceBtn").addEventListener("click", newInvoice);
  $("shareBtn").addEventListener("click", () => window.print());

  $("importJsonBtn").addEventListener("click", () => $("importJsonInput").click());
  $("importJsonInput").addEventListener("change", importJson);
  $("exportJsonBtn").addEventListener("click", exportJson);

  [
    "bizName","bizEmail","bizPhone","bizAddr",
    "invNumber","invDate","dueDate","currency","discountRate",
    "notes","terms","clientName","clientEmail","clientPhone","clientAddr"
  ].forEach(id => $(id).addEventListener("input", render));

  const lastBiz = JSON.parse(localStorage.getItem("lastBiz.v1") || "null");
  if (lastBiz) setInvoice({ business:lastBiz, invoice:{ date:today, number:"INV-" + Date.now().toString().slice(0, 6), currency:"$" }, items:[] });
  else render();

  // Offline support
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
});
