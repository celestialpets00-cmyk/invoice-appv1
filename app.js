/* ==== HOTFIX: one-time SW/cache reset + version badge ==== */
(function(){
  document.documentElement.setAttribute('data-build', 'r11.1-hotfix');
  if (!localStorage.getItem('sw_reset_done_r111')) {
    localStorage.setItem('sw_reset_done_r111', '1');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(rs => Promise.all(rs.map(r => r.unregister())))
        .then(() => caches.keys())
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => {
          const u = new URL(location.href);
          u.searchParams.set('v', String(Date.now()).slice(-6));
          if (!u.hash) u.hash = '#home';
          location.replace(u.toString());
        });
    }
  }
})();

// ===== Heavy Metal Medics — Invoice App (v11.1, routed pages + hardened) =====
const $ = (id) => document.getElementById(id);
const has = (id) => !!$(id);
const on = (id, evt, fn) => { const el = $(id); if (el && el.addEventListener) el.addEventListener(evt, fn); };
const val = (id, def = "") => { const el = $(id); return (el && "value" in el) ? el.value : def; };
const setVal = (id, v) => { const el = $(id); if (el && "value" in el) el.value = v; };

const LOGO_SRC = "icons/icon-192.png";

const state = {
  items: [],
  invoices: JSON.parse(localStorage.getItem("invoices.v1") || "[]"),
  presets: JSON.parse(localStorage.getItem("presets.v1") || "null") || [
    { label: "Labour", price: 110, qty: 1 },
    { label: "Travel", price: 110, qty: 1 }
  ],
  customers: JSON.parse(localStorage.getItem("customers.v1") || "[]"),
  expenses: JSON.parse(localStorage.getItem("expenses.v1") || "[]"),
  GST_RATE: 5,
  paid: false
};

// ===== helpers (money, CSV, etc.) =====
const moneySym = () => (val("currency") || "$");
const money = (n) => moneySym() + Number(n || 0).toFixed(2);
const escapeHtml = (s) => (s || "").replace(/[&<>\"']/g,(m)=>({"&":"&amp;","<":"&lt;","&gt;":">","\"":"&quot;","'":"&#039;"}[m]));
const nl2br = (s) => (s || "").replace(/\n/g,"<br>");
const toISO = (d) => d.toISOString().slice(0,10);
const parseISO = (s) => { const d = new Date(s); return isFinite(d) ? d : new Date(); };
const sum = (arr, pick)=> arr.reduce((s,x)=> s + Number(pick?pick(x):x)||0, 0);

function toCsvValue(v){ const s=String(v ?? "").replace(/\"/g,'""'); return /[",\n]/.test(s)?'"'+s+'"':s; }
function downloadCsv(name, rows){
  const csv = rows.map(r=>r.map(toCsvValue).join(",")).join("\n");
  const blob = new Blob([csv],{type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=name; a.click();
  URL.revokeObjectURL(url);
}

// ===== Items =====
function addItem(i=null){
  if (!$("#items")) return;
  const idx = state.items.length;
  const it = i || { description:"", qty:1, price:0 };
  state.items.push(it);

  const wrap = document.createElement("div");
  wrap.className="item";
  wrap.dataset.index=idx;
  wrap.innerHTML = `
    <label>Description<input placeholder="Service / Part" value="${it.description}"></label>
    <label>Qty<input type="number" step="0.01" value="${it.qty}"></label>
    <label>Price<input type="number" step="0.01" value="${it.price}"></label>
    <button class="remove">Remove</button>
  `;
  const inputs = wrap.querySelectorAll("input");
  inputs[0]?.addEventListener("input",(e)=>{ it.description=e.target.value; render(); });
  inputs[1]?.addEventListener("input",(e)=>{ it.qty=parseFloat(e.target.value||0); render(); });
  inputs[2]?.addEventListener("input",(e)=>{ it.price=parseFloat(e.target.value||0); render(); });

  wrap.querySelector(".remove")?.addEventListener("click",()=>{
    const i = parseInt(wrap.dataset.index,10);
    state.items.splice(i,1);
    $("#items").innerHTML="";
    const copy=[...state.items]; state.items.length=0; copy.forEach(addItem);
    render();
  });

  $("#items").appendChild(wrap);
  render();
}

// ... [all the other code stays exactly as in the working v11 build I gave you: presets, customers, invoices, profit/expenses, render(), router, init, etc.] ...

// ===== Router =====
const PAGES = ["home","history","customers","profit","profit-details"];
function routeTo(hash){
  const page = (hash||"").replace(/^#/, "") || "home";
  PAGES.forEach(p=>{
    const el = document.querySelector(`[data-page="${p}"]`);
    if (el) el.classList.toggle("active", p===page);
  });
  if (page==="history"){ renderHistoryList(val("historySearch")); }
  if (page==="customers"){ renderCustomersList(val("customerSearch")); }
  if (page==="profit"){ fillProfitRange(); renderProfit(); }
  if (page==="profit-details"){ showProfitDetails(true); }
}
window.addEventListener("hashchange", ()=> routeTo(location.hash));

// ===== Init =====
window.addEventListener("load", ()=>{
  // [keep your working init wiring here: same as v11 build]
  // ...
  routeTo(location.hash);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
});

/* ==== HOTFIX: click safety net for critical actions ==== */
document.addEventListener('click', (ev) => {
  const t = ev.target;
  if (t && t.id === 'addItemBtn') {
    ev.preventDefault();
    try { addItem(); } catch (e) { alert('Add Item failed: ' + (e?.message || e)); }
    return;
  }
  if (t && t.id === 'historySearch') {
    t.addEventListener('blur', () => renderHistoryList(t.value));
  }
  if (t && (t.id === 'profitDetailsBtn' || t.id === 'profitTotalBtn')) {
    ev.preventDefault();
    location.hash = '#profit-details';
    showProfitDetails(true);
  }
});
