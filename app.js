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

function setInvoice(d
