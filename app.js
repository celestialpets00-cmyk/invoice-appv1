// ====== Heavy Metal Medics — Invoice App ======
const $ = (id) => document.getElementById(id);

// Use the app icon as the default/logo everywhere
const LOGO_SRC = "icons/icon-192.png";

const state = {
  items: [],
  invoices: JSON.parse(localStorage.getItem("invoices.v1") || "[]"),
};

// Money formatter using the currency symbol in the form
function money(n) {
  const c = $("currency").value || "$";
  return c + Number(n || 0).toFixed(2);
}

// Add a new line item row (or from existing data)
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

  wrap.querySelectorAll("input")[0].addEventListener("input", (e) => {
    item.description = e.target.value;
    render();
  });
  wrap.querySelectorAll("input")[1].addEventListener("input", (e) => {
    item.qty = parseFloat(e.target.value || 0);
    render();
  });
  wrap.querySelectorAll("input")[2].addEventListener("input", (e) => {
    item.price = parseFloat(e.target.value || 0);
    render();
  });

  wrap.querySelector(".remove").addEventListener("click", () => {
    const i = parseInt(wrap.dataset.index, 10);
    state.items.splice(i, 1);
    document.querySelector("#items").innerHTML = "";
    const copy = [...state.items];
    state.items.length = 0;
    copy.forEach(addItem);
    render();
  });

  document.querySelector("#items").appendChild(wrap);
  render();
}

function calcTotals() {
  const subtotal = state.items.reduce((s, it) => s + (it.qty * it.price), 0);
  const discRate = parseFloat($("discountRate").value || 0) / 100;
  const taxRate  = parseFloat($("taxRate").value || 0) / 100;
  const discount = subtotal * discRate;
  const taxable  = Math.max(0, subtotal - discount);
  const tax      = taxable * taxRate;
  const total    = taxable + tax;
  return { subtotal, discount, tax, total };
}

function currentInvoice() {
  return {
    business: {
      name: $("bizName").value || "Heavy Metal Medics",
      email: $("bizEmail").value,
      phone: $("bizPhone").value,
      addr:  $("bizAddr").value,
      logo:  LOGO_SRC, // use the app icon as the invoice logo
    },
    invoice: {
      number: $("invNumber").value,
      date: $("invDate").value,
      due:  $("dueDate").value,
      currency: $("currency").value,
      taxRate: $("taxRate").value,
      discountRate: $("discountRate").value,
      notes: $("notes").value,
      terms: $("terms").value,
    },
    client: {
      name: $("clientName").value,
      email: $("clientEmail").value,
      phone: $("clientPhone").value,
      addr:  $("clientAddr").value,
    },
    items: state.items,
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
  $("taxRate").value   = data.invoice?.taxRate ?? 0;
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

function escapeHtml(s) {
  return (s || "").replace(/[&<>\"']/g, (m) => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[m]
  ));
}
function nl2br(s) { return (s || "").replace(/\n/g, "<br>"); }

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
          <tr><td colspan="3" style="text-align:right">Tax (${Number(inv.invoice.taxRate || 0)}%)</td><td>${money(tax)}</td></tr>
          <tr><td colspan="3" style="text-align:right;color:#2e7d32"><strong>Total</strong></td><td style="color:#2e7d32"><strong>${money(total)}</strong></td></tr>
        </tfoot>
      </table>

      ${inv.invoice.notes ? `<div style="margin-top:10px"><strong>Notes:</strong><br>${nl2br(escapeHtml(inv.invoice.notes))}</div>` : ""}
      ${inv.invoice.terms ? `<div style="margin-top:10px"><strong>Terms:</strong><br>${nl2br(escapeHtml(inv.invoice.terms))}</div>` : ""}
    </div>
  `;
}

// Save / Load / New
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
      logo:  LOGO_SRC,
    },
    invoice: {
      number: "INV-" + Date.now().toString().slice(-6),
      date: new Date().toISOString().slice(0, 10),
      due: "",
      currency: "$",
      taxRate: 0,
      discountRate: 0,
      notes: "",
      terms: "",
    },
    client: {},
    items: [],
  });
}

// Export / Import JSON
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

// Init
window.addEventListener("load", () => {
  const today = new Date().toISOString().slice(0, 10);
  $("invDate").value = today;
  $("invNumber").value = "INV-" + Date.now().toString().slice(-6);

  $("addItemBtn").addEventListener("click", () => addItem());
  $("saveInvoiceBtn").addEventListener("click", saveInvoice);
  $("loadInvoiceBtn").addEventListener("click", loadInvoice);
  $("newInvoiceBtn").addEventListener("click", newInvoice);
  $("shareBtn").addEventListener("click", () => window.print());

  $("importJsonBtn").addEventListener("click", () => $("importJsonInput").click());
  $("importJsonInput").addEventListener("change", importJson);
  $("exportJsonBtn").addEventListener("click", exportJson);

  [
    "bizName","bizEmail","bizPhone","bizAddr",
    "invNumber","invDate","dueDate","currency","taxRate","discountRate",
    "notes","terms","clientName","clientEmail","clientPhone","clientAddr"
  ].forEach(id => $(id).addEventListener("input", render));

  const lastBiz = JSON.parse(localStorage.getItem("lastBiz.v1") || "null");
  if (lastBiz) setInvoice({ business:lastBiz, invoice:{ date:today, number:"INV-" + Date.now().toString().slice(-6), currency:"$" }, items:[] });
  else render();
});
