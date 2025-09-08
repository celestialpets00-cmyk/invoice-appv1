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
      taxRate: state.GST_RATE,         // fixed_
