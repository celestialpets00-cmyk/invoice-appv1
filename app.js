// ====== Heavy Metal Medics — Invoice App (v8 with CSV export) ======
const $ = (id) => document.getElementById(id);
const LOGO_SRC = "icons/icon-192.png";

const state = {
  items: [],
  invoices: JSON.parse(localStorage.getItem("invoices.v1") || "[]"),
  presets: JSON.parse(localStorage.getItem("presets.v1") || "null") || [
    { label: "Labour", price: 110, qty: 1 },
    { label: "Travel", price: 110, qty: 1 }
  ],
  customers: JSON.parse(localStorage.getItem("customers.v1") || "[]"),
  GST_RATE: 5, // fixed GST %
  paid: false
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

// Compute totals for an existing saved invoice object
function computeTotalsFrom(inv) {
  const subtotal = (inv.items || []).reduce((s, it) => s + (Number(it.qty||0) * Number(it.price||0)), 0);
  const discRate = Number(inv.invoice?.discountRate || 0) / 100;
  const taxRate  = Number(inv.invoice?.taxRate ?? state.GST_RATE) / 100;
  const discount = subtotal * discRate;
  const taxable  = Math.max(0, subtotal - discount);
  const tax      = taxable * taxRate;
  const total    = taxable + tax;
  return { subtotal, discount, tax, total };
}

// ---------- CSV Helpers ----------
function toCsvValue(v) {
  const s = String(v ?? "").replace(/\"/g, '""');
  // Quote if contains comma, quote, or newline
  if (/[",\n]/.test(s)) return '"' + s + '"';
  return s;
}
function downloadCsv(filename, rows) {
  const csv = rows.map(r => r.map(toCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

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

// ---------- Customers ----------
function saveCustomersToStorage() {
  localStorage.setItem("customers.v1", JSON.stringify(state.customers));
}

function saveCurrentAsCustomer() {
  const cust = {
    name: $("clientName").value.trim(),
    email: $("clientEmail").value.trim(),
    phone: $("clientPhone").value.trim(),
    addr: $("clientAddr").value.trim()
  };
  if (!cust.name && !cust.email && !cust.phone) {
    alert("Please enter at least a name, email, or phone to save.");
    return;
  }
  const key = (s)=> (s||"").toLowerCase();
  const idx = state.customers.findIndex(c =>
    key(c.name)===key(cust.name) && key(c.email)===key(cust.email) && key(c.phone)===key(cust.phone)
  );
  if (idx >= 0) {
    state.customers[idx] = cust;
  } else {
    state.customers.unshift(cust);
  }
  saveCustomersToStorage();
  alert("Customer saved.");
}

function showCustomers(show) {
  $("customersCard").style.display = show ? "block" : "none";
  if (show) {
    $("customerSearch").value = "";
    renderCustomersList("");
  }
}

function renderCustomersList(filterText="") {
  const list = $("customersList");
  const q = (filterText || "").toLowerCase();
  const filtered = state.customers.filter(c => {
    return (c.name||"").toLowerCase().includes(q)
        || (c.email||"").toLowerCase().includes(q)
        || (c.phone||"").toLowerCase().includes(q);
  });

  const rows = filtered.map((c, i) => {
    const name = escapeHtml(c.name||"");
    const email = escapeHtml(c.email||"");
    const phone = escapeHtml(c.phone||"");
    const addr = escapeHtml(c.addr||"").replace(/\n/g," ");
    return `
      <tr>
        <td><strong>${name}</strong><div class="muted">${email || ""} ${phone ? " · " + phone : ""}</div></td>
        <td>${addr}</td>
        <td class="row-actions">
          <button data-act="use" data-idx="${i}">Use</button>
          <button data-act="del" data-idx="${i}" class="secondary">Delete</button>
        </td>
      </tr>
    `;
  }).join("");

  list.innerHTML = `
    <div class="history-list">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Address</th>
            <th style="width:160px">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="3" class="muted">No saved customers yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  list.querySelectorAll("button[data-act='use']").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.getAttribute("data-idx"), 10);
      const c = filtered[i];
      if (!c) return;
      $("clientName").value = c.name || "";
      $("clientEmail").value = c.email || "";
      $("clientPhone").value = c.phone || "";
      $("clientAddr").value = c.addr || "";
      render();
      showCustomers(false);
    });
  });

  list.querySelectorAll("button[data-act='del']").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = parseInt(btn.getAttribute("data-idx"), 10);
      const c = filtered[i];
      const realIndex = state.customers.findIndex(x => x === c);
      if (realIndex >= 0 && confirm(`Delete ${c.name || "this customer"}?`)) {
        state.customers.splice(realIndex, 1);
        saveCustomersToStorage();
        renderCustomersList($("customerSearch").value);
      }
    });
  });
}

// ---------- Totals (live) ----------
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
    items: state.items,
    paid: state.paid || false
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

  state.paid = !!data.paid;

  document.querySelector("#items").innerHTML = "";
  state.items = [];
  (data.items || []).forEach(addItem);

  render();
}

// ---------- Saved Invoices (History) ----------
function saveInvoicesToStorage() {
  localStorage.setItem("invoices.v1", JSON.stringify(state.invoices));
}

function showHistory(show) {
  $("historyCard").style.display = show ? "block" : "none";
  if (show) {
    $("historySearch").value = "";
    renderHistoryList("");
  }
}

function renderHistoryList(filterText = "") {
  const list = $("historyList");
  const q = (filterText || "").toLowerCase();

  const filtered = state.invoices.filter(inv => {
    const num = (inv.invoice?.number || "").toLowerCase();
    const client = (inv.client?.name || "").toLowerCase();
    return num.includes(q) || client.includes(q);
  });

  const rows = filtered.map((inv, i) => {
    const { total } = computeTotalsFrom(inv);
    const num = escapeHtml(inv.invoice?.number || "");
    const date = escapeHtml(inv.invoice?.date || "");
    const client = escapeHtml(inv.client?.name || "");
    const paid = inv.paid ? '<span class="badge-paid">PAID</span>' : '';
    return `
      <tr>
        <td>${num} ${paid}</td>
        <td>${date}</td>
        <td>${client}</td>
        <td>${money(total)}</td>
        <td class="row-actions">
          <button data-act="open" data-num="${num}">Open</button>
          <button data-act="del" data-num="${num}" class="secondary">Delete</button>
        </td>
      </tr>
    `;
  }).join("");

  list.innerHTML = `
    <div class="history-list">
      <table>
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Date</th>
            <th>Client</th>
            <th>Total</th>
            <th style="width:160px">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="5" class="muted">No saved invoices yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  // Wire row buttons
  list.querySelectorAll("button[data-act='open']").forEach(btn => {
    btn.addEventListener("click", () => {
      const num = btn.getAttribute("data-num");
      const inv = state.invoices.find(x => (x.invoice?.number || "") === num);
      if (inv) {
        setInvoice(inv);
        showHistory(false);
      }
    });
  });
  list.querySelectorAll("button[data-act='del']").forEach(btn => {
    btn.addEventListener("click", () => {
      const num = btn.getAttribute("data-num");
      const idx = state.invoices.findIndex(x => (x.invoice?.number || "") === num);
      if (idx >= 0 && confirm(`Delete invoice ${num}?`)) {
        state.invoices.splice(idx, 1);
        saveInvoicesToStorage();
        renderHistoryList($("historySearch").value);
      }
    });
  });
}

// ---------- Backup / Restore ----------
function exportJson() {
  const blob = new Blob([JSON.stringify({ invoices: state.invoices, presets: state.presets, customers: state.customers }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "invoices_backup.json"; a.click();
  URL.revokeObjectURL(url);
}

// CSV Exporters
function exportCustomersCsv() {
  const rows = [["Name","Email","Phone","Address"]];
  state.customers.forEach(c => rows.push([c.name||"", c.email||"", c.phone||"", (c.addr||"").replace(/\n/g, " ")]));
  downloadCsv("customers.csv", rows);
}

function exportInvoicesCsv() {
  const rows = [["Invoice #","Date","Client","Email","Phone","Subtotal","Discount","GST","Total","Paid","Items"]];
  state.invoices.forEach(inv => {
    const { subtotal, discount, tax, total } = computeTotalsFrom(inv);
    const itemsText = (inv.items||[]).map(it => `${(it.description||"").replace(/,/g," ")} x${it.qty} @ ${it.price}`).join(" | ");
    rows.push([
      inv.invoice?.number || "",
      inv.invoice?.date || "",
      inv.client?.name || "",
      inv.client?.email || "",
      inv.client?.phone || "",
      subtotal.toFixed(2),
      discount.toFixed(2),
      tax.toFixed(2),
      total.toFixed(2),
      inv.paid ? "Yes" : "No",
      itemsText
    ]);
  });
  downloadCsv("invoices.csv", rows);
}

function importJson(e) {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data)) {
        state.invoices = data;
      } else {
        if (Array.isArray(data.invoices)) state.invoices = data.invoices;
        if (Array.isArray(data.presets)) state.presets = data.presets;
        if (Array.isArray(data.customers)) state.customers = data.customers;
      }
      localStorage.setItem("invoices.v1", JSON.stringify(state.invoices));
      localStorage.setItem("presets.v1", JSON.stringify(state.presets));
      localStorage.setItem("customers.v1", JSON.stringify(state.customers));
      renderPresetButtons();
      alert("Imported.");
    } catch {
      alert("Invalid JSON");
    }
  };
  reader.readAsText(f);
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
          <tr>
            <td colspan="3" style="text-align:right;color:#2e7d32"><strong>Total</strong></td>
            <td style="color:#2e7d32">
              <strong>${money(total)}</strong>
              ${state.paid ? '<span style="color:red; font-weight:bold; margin-left:8px">PAID</span>' : ""}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  // Update toggle button label
  const mp = $("markPaidBtn");
  if (mp) mp.textContent = state.paid ? "Mark Unpaid" : "Mark Paid";
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

  // Invoices screen
  $("loadInvoiceBtn").addEventListener("click", () => showHistory(true));
  $("historyClose").addEventListener("click", () => showHistory(false));
  $("historySearch").addEventListener("input", (e) => renderHistoryList(e.target.value));

  // Customers
  $("saveCustomerBtn").addEventListener("click", saveCurrentAsCustomer);
  $("openCustomersBtn").addEventListener("click", () => showCustomers(true));
  $("openCustomersInlineBtn").addEventListener("click", () => showCustomers(true));
  $("customersClose").addEventListener("click", () => showCustomers(false));
  $("customerSearch").addEventListener("input", (e) => renderCustomersList(e.target.value));

  // Save/New/Share
  $("saveInvoiceBtn").addEventListener("click", () => {
    const inv = currentInvoice();
    if (!inv.invoice.number) { alert("Please set an Invoice # first."); return; }
    const i = state.invoices.findIndex(x => x.invoice.number === inv.invoice.number);
    if (i >= 0) state.invoices[i] = inv;
    else state.invoices.unshift(inv);
    localStorage.setItem("invoices.v1", JSON.stringify(state.invoices));
    alert("Saved locally.");
  });

  $("newInvoiceBtn").addEventListener("click", () => {
    const biz = JSON.parse(localStorage.getItem("lastBiz.v1") || "{}");
    state.paid = false;
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
        items: [],
        paid: false
    });
  });

  $("shareBtn").addEventListener("click", () => window.print());

  // Paid toggle
  $("markPaidBtn").addEventListener("click", () => {
    state.paid = !state.paid;
    render();
    alert(state.paid ? "Invoice marked as PAID." : "Invoice marked as UNPAID.");
  });

  // Export/Import
  $("importJsonBtn").addEventListener("click", () => $("importJsonInput").click());
  $("importJsonInput").addEventListener("change", importJson);
  $("exportJsonBtn").addEventListener("click", exportJson);
  $("exportCustomersCsvBtn").addEventListener("click", exportCustomersCsv);
  $("exportInvoicesCsvBtn").addEventListener("click", exportInvoicesCsv);

  [
    "bizName","bizEmail","bizPhone","bizAddr",
    "invNumber","invDate","dueDate","currency","discountRate",
    "notes","terms","clientName","clientEmail","clientPhone","clientAddr"
  ].forEach(id => $(id).addEventListener("input", render));

  const lastBiz = JSON.parse(localStorage.getItem("lastBiz.v1") || "null");
  if (lastBiz) setInvoice({ business:lastBiz, invoice:{ date:today, number:"INV-" + Date.now().toString().slice(0, 6), currency:"$" }, items:[], paid:false });
  else render();

  // Offline support
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
});
