// ===== Heavy Metal Medics — Invoice App (v10.2 hardened) =====
const $ = (id) => document.getElementById(id);

// Safe helpers
const val = (id, def = "") => { const el = $(id); return (el && "value" in el) ? el.value : def; };
const setVal = (id, v) => { const el = $(id); if (el && "value" in el) el.value = v; };
const on = (id, evt, fn) => { const el = $(id); if (el && el.addEventListener) el.addEventListener(evt, fn); };
const has = (id) => !!$(id);
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

// ---------- Utils ----------
const moneySym = () => (val("currency") || "$");
const money = (n) => moneySym() + Number(n || 0).toFixed(2);
const escapeHtml = (s) => (s || "").replace(/[&<>\"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
const nl2br = (s) => (s || "").replace(/\n/g,"<br>");
const toISO = (d) => d.toISOString().slice(0,10);
const parseISO = (s) => { const d = new Date(s); return isFinite(d) ? d : new Date(); };
const sum = (arr, pick)=> arr.reduce((s,x)=> s + Number(pick?pick(x):x)||0, 0);

function computeTotalsFrom(inv){
  const subtotal = (inv.items||[]).reduce((s,it)=> s + (Number(it.qty||0)*Number(it.price||0)), 0);
  const discRate = Number(inv.invoice?.discountRate || 0) / 100;
  const taxRate  = Number(inv.invoice?.taxRate ?? state.GST_RATE) / 100;
  const discount = subtotal * discRate;
  const taxable  = Math.max(0, subtotal - discount);
  const tax      = taxable * taxRate;
  const total    = taxable + tax;
  return { subtotal, discount, tax, total };
}

// CSV helpers
function toCsvValue(v){ const s=String(v ?? "").replace(/\"/g,'""'); return /[",\n]/.test(s)?'"'+s+'"':s; }
function downloadCsv(name, rows){ const csv = rows.map(r=>r.map(toCsvValue).join(",")).join("\n"); const blob = new Blob([csv],{type:"text/csv"}); const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url); }

// ---------- Items ----------
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

// ---------- Presets ----------
function savePresets(){ localStorage.setItem("presets.v1", JSON.stringify(state.presets)); }
function renderPresetButtons(){
  const holder = $("#presetButtons"); if (!holder) return;
  holder.innerHTML = "";
  state.presets.forEach((p,idx)=>{
    const btn = document.createElement("button");
    btn.className = "secondary";
    btn.textContent = `+ ${p.label} ${money(p.price)}${p.qty!==1?" ×"+p.qty:""}`;
    btn.style.position="relative";
    btn.addEventListener("click",()=> addItem({description:p.label, qty:p.qty, price:p.price}));

    const del = document.createElement("span");
    del.textContent="×"; del.title="Remove preset";
    del.style.cssText="position:absolute;top:-6px;right:-6px;background:#f8d7da;color:#a33;border:1px solid #a33;border-radius:10px;padding:0 6px;cursor:pointer;font-size:12px;line-height:18px;";
    del.addEventListener("click",(e)=>{ e.stopPropagation(); if (confirm(`Remove preset "${p.label}"?`)){ state.presets.splice(idx,1); savePresets(); renderPresetButtons(); } });

    const wrap=document.createElement("div");
    wrap.style.position="relative";
    wrap.appendChild(btn); wrap.appendChild(del);
    holder.appendChild(wrap);
  });
}
function wirePresetForm(){
  on("addPresetBtn","click",()=>{
    const name=(val("presetName")||"").trim();
    const price=parseFloat(val("presetPrice")||0);
    const qty=parseFloat(val("presetQty")||1);
    if (!name) return alert("Please enter a label.");
    if (!(price>=0)) return alert("Please enter a price.");
    if (!(qty>0)) return alert("Please enter a quantity.");
    state.presets.push({label:name, price, qty});
    savePresets(); renderPresetButtons();
    setVal("presetName",""); setVal("presetPrice","110"); setVal("presetQty","1");
  });
}

// ---------- Customers ----------
function saveCustomers(){ localStorage.setItem("customers.v1", JSON.stringify(state.customers)); }
function saveCurrentAsCustomer(){
  const c = {
    name: val("clientName").trim(),
    email: val("clientEmail").trim(),
    phone: val("clientPhone").trim(),
    addr:  val("clientAddr").trim()
  };
  if (!c.name && !c.email && !c.phone) return alert("Please enter at least a name, email, or phone.");
  const key=(s)=> (s||"").toLowerCase();
  const i=state.customers.findIndex(x=> key(x.name)===key(c.name) && key(x.email)===key(c.email) && key(x.phone)===key(c.phone));
  if (i>=0) state.customers[i]=c; else state.customers.unshift(c);
  saveCustomers(); alert("Customer saved.");
}
function showCustomers(show){
  if (!has("customersCard")) return;
  $("customersCard").style.display = show ? "block" : "none";
  if (show){ setVal("customerSearch",""); renderCustomersList(""); }
}
function renderCustomersList(qText=""){
  if (!has("customersList")) return;
  const q=(qText||"").toLowerCase();
  const filtered = state.customers.filter(c=>
    (c.name||"").toLowerCase().includes(q)
    || (c.email||"").toLowerCase().includes(q)
    || (c.phone||"").toLowerCase().includes(q)
  );
  const rows = filtered.map((c,i)=>`
    <tr>
      <td><strong>${escapeHtml(c.name||"")}</strong><div class="muted">${escapeHtml(c.email||"")} ${c.phone?" · "+escapeHtml(c.phone):""}</div></td>
      <td>${escapeHtml((c.addr||"").replace(/\n/g," "))}</td>
      <td class="row-actions">
        <button data-act="use" data-idx="${i}">Use</button>
        <button data-act="del" data-idx="${i}" class="secondary">Delete</button>
      </td>
    </tr>
  `).join("");
  $("customersList").innerHTML = `
    <div class="history-list"><table>
      <thead><tr><th>Customer</th><th>Address</th><th style="width:160px">Actions</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3" class="muted">No saved customers yet.</td></tr>'}</tbody>
    </table></div>
  `;

  $("customersList").querySelectorAll("button[data-act='use']").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i=parseInt(btn.getAttribute("data-idx"),10);
      const c=filtered[i]; if (!c) return;
      setVal("clientName", c.name||"");
      setVal("clientEmail", c.email||"");
      setVal("clientPhone", c.phone||"");
      setVal("clientAddr", c.addr||"");
      render(); showCustomers(false);
    });
  });
  $("customersList").querySelectorAll("button[data-act='del']").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i=parseInt(btn.getAttribute("data-idx"),10);
      const c=filtered[i];
      const real=state.customers.findIndex(x=>x===c);
      if (real>=0 && confirm(`Delete ${c.name||"this customer"}?`)){
        state.customers.splice(real,1); saveCustomers(); renderCustomersList(val("customerSearch"));
      }
    });
  });
}

// ---------- Totals (live) ----------
function calcTotals(){
  const subtotal = state.items.reduce((s,it)=> s + (it.qty*it.price), 0);
  const discRate = parseFloat(val("discountRate")||0) / 100;
  const gstRate  = state.GST_RATE / 100;
  const discount = subtotal * discRate;
  const taxable  = Math.max(0, subtotal - discount);
  const tax      = taxable * gstRate;
  const total    = taxable + tax;
  return { subtotal, discount, tax, total };
}

// ---------- Invoice data ----------
function currentInvoice(){
  return {
    business:{ name:val("bizName")||"Heavy Metal Medics", email:val("bizEmail"), phone:val("bizPhone"), addr:val("bizAddr"), logo:LOGO_SRC },
    invoice:{ number:val("invNumber"), date:val("invDate"), due:val("dueDate"), currency:val("currency")||"$", taxRate:state.GST_RATE, discountRate:val("discountRate"), notes:val("notes"), terms:val("terms") },
    client:{ name:val("clientName"), email:val("clientEmail"), phone:val("clientPhone"), addr:val("clientAddr") },
    items: state.items,
    paid: state.paid || false
  };
}
function setInvoice(data){
  setVal("bizName",   data.business?.name  ?? "Heavy Metal Medics");
  setVal("bizEmail",  data.business?.email ?? "");
  setVal("bizPhone",  data.business?.phone ?? "");
  setVal("bizAddr",   data.business?.addr  ?? "");

  setVal("invNumber", data.invoice?.number ?? "");
  setVal("invDate",   data.invoice?.date   ?? "");
  setVal("dueDate",   data.invoice?.due    ?? "");
  setVal("currency",  data.invoice?.currency ?? "$");

  if (has("taxRate")) { setVal("taxRate", String(state.GST_RATE)); $("taxRate").setAttribute("disabled","disabled"); }
  setVal("discountRate", data.invoice?.discountRate ?? 0);
  setVal("notes",     data.invoice?.notes ?? "");
  setVal("terms",     data.invoice?.terms ?? "");

  setVal("clientName",  data.client?.name ?? "");
  setVal("clientEmail", data.client?.email ?? "");
  setVal("clientPhone", data.client?.phone ?? "");
  setVal("clientAddr",  data.client?.addr ?? "");

  state.paid = !!data.paid;

  if ($("#items")){
    $("#items").innerHTML = "";
    state.items = [];
    (data.items || []).forEach(addItem);
  }
  render();
}

// ---------- Storage ----------
const saveInvoices = ()=> localStorage.setItem("invoices.v1", JSON.stringify(state.invoices));
const saveExpenses = ()=> localStorage.setItem("expenses.v1", JSON.stringify(state.expenses));

// ---------- History ----------
function showHistory(show){ if (!has("historyCard")) return; $("historyCard").style.display=show?"block":"none"; if (show){ setVal("historySearch",""); renderHistoryList(""); } }
function renderHistoryList(filterText=""){
  if (!has("historyList")) return;
  const q=(filterText||"").toLowerCase();
  const filtered=state.invoices.filter(inv=>{
    const num=(inv.invoice?.number||"").toLowerCase();
    const client=(inv.client?.name||"").toLowerCase();
    return num.includes(q)||client.includes(q);
  });
  const rows=filtered.map(inv=>{
    const {total}=computeTotalsFrom(inv);
    const num=escapeHtml(inv.invoice?.number||"");
    const date=escapeHtml(inv.invoice?.date||"");
    const client=escapeHtml(inv.client?.name||"");
    const paid=inv.paid?'<span class="badge-paid">PAID</span>':'';
    return `<tr>
      <td>${num} ${paid}</td><td>${date}</td><td>${client}</td><td>${money(total)}</td>
      <td class="row-actions"><button data-act="open" data-num="${num}">Open</button><button data-act="del" data-num="${num}" class="secondary">Delete</button></td>
    </tr>`;
  }).join("");
  $("historyList").innerHTML = `
    <div class="history-list"><table>
      <thead><tr><th>Invoice #</th><th>Date</th><th>Client</th><th>Total</th><th style="width:160px">Actions</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="muted">No saved invoices yet.</td></tr>'}</tbody>
    </table></div>`;

  $("historyList").querySelectorAll("button[data-act='open']").forEach(b=>b.addEventListener("click",()=>{
    const num=b.getAttribute("data-num"); const inv=state.invoices.find(x=>(x.invoice?.number||"")===num); if (inv){ setInvoice(inv); showHistory(false); }
  }));
  $("historyList").querySelectorAll("button[data-act='del']").forEach(b=>b.addEventListener("click",()=>{
    const num=b.getAttribute("data-num"); const i=state.invoices.findIndex(x=>(x.invoice?.number||"")===num);
    if (i>=0 && confirm(`Delete invoice ${num}?`)){ state.invoices.splice(i,1); saveInvoices(); renderHistoryList(val("historySearch")); renderProfit(); }
  }));
}

// ---------- Profit & Expenses ----------
function rangeOptions(){
  const years = new Set([
    ...state.invoices.map(inv => (inv.invoice?.date||"").slice(0,4)).filter(Boolean),
    ...state.expenses.map(e => (e.date||"").slice(0,4)).filter(Boolean),
    String(new Date().getFullYear())
  ]);
  const sorted=[...years].sort((a,b)=>b.localeCompare(a));
  return [
    {val:"last30", label:"Last 30 days"},
    {val:"thisyear", label:`This Year (${new Date().getFullYear()})`},
    ...sorted.map(y=>({val:`year:${y}`, label:y})),
    {val:"all", label:"All time"}
  ];
}
function fillProfitRange(){ if (!has("profitRange")) return; $("profitRange").innerHTML = rangeOptions().map(o=>`<option value="${o.val}">${o.label}</option>`).join(""); $("profitRange").value="last30"; }
function inRange(dateStr, r){
  const d = parseISO(dateStr); const today=new Date(); const yStart=new Date(today.getFullYear(),0,1);
  if (r==="last30"){ const from=new Date(today); from.setDate(from.getDate()-30); return d>=from && d<=today; }
  if (r==="thisyear") return d>=yStart && d<=today;
  if (r==="all") return true;
  if ((r||"").startsWith("year:")){ const y=+r.split(":")[1]; const from=new Date(y,0,1); const to=new Date(y,11,31,23,59,59); return d>=from && d<=to; }
  return true;
}
const paidInvoicesInRange = (r)=> state.invoices.filter(inv => inv.paid && inv.invoice?.date && inRange(inv.invoice.date, r));
const expensesInRange    = (r)=> state.expenses.filter(e => e.date && inRange(e.date, r));

function drawExpensesDonut(buckets){
  if (!has("expensesDonut")) return;
  const canvas=$("expensesDonut"); const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const cx=canvas.width/2, cy=canvas.height/2, r=70, inner=40;
  const colors=["#2e7d32","#219a6b","#66bb6a","#9ccc65","#26a69a","#43a047"];
  const total=sum(buckets,b=>b.amount);
  if (total<=0){ ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.strokeStyle="#e0e0e0"; ctx.lineWidth=r-inner; ctx.stroke(); return; }
  let start=-Math.PI/2;
  buckets.forEach((b,i)=>{ const frac=b.amount/total; const end=start+frac*Math.PI*2; ctx.beginPath(); ctx.strokeStyle=colors[i%colors.length]; ctx.lineWidth=r-inner; ctx.arc(cx,cy,r,start,end); ctx.stroke(); start=end; });
}
function renderExpensesBreakdown(rangeVal){
  if (!has("expensesBreakdown") || !has("expensesList")) return;
  const exps=expensesInRange(rangeVal);
  const byName={}; exps.forEach(e=>{ const k=(e.name||"Other").trim()||"Other"; byName[k]=(byName[k]||0)+Number(e.amount||0); });
  const entries = Object.entries(byName).map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount);
  const top = entries.slice(0,4); const otherAmount = sum(entries.slice(4), e=>e.amount);
  const donutBuckets = otherAmount>0 ? [...top, {name:"Other", amount:otherAmount}] : top;

  drawExpensesDonut(donutBuckets);

  $("expensesBreakdown").innerHTML = donutBuckets.map((e,i)=>`
    <li><span class="dot" style="background:${['#2e7d32','#219a6b','#66bb6a','#9ccc65','#26a69a','#43a047'][i%6]}"></span>
      <span>${escapeHtml(e.name.length>18 ? e.name.slice(0,18)+"…" : e.name)}</span>
      <strong style="margin-left:auto">${money(e.amount)}</strong>
    </li>`).join("");

  const total = sum(exps, e=>e.amount);
  if (has("expensesTotal")) $("expensesTotal").textContent = money(total);

  const rows = exps.sort((a,b)=> (b.date||"").localeCompare(a.date||"")).map(e=>`
    <tr>
      <td>${escapeHtml(e.name||"")}</td><td>${escapeHtml(e.date||"")}</td><td>${money(e.amount||0)}</td>
      <td class="row-actions"><button data-id="${e.id}" data-act="del" class="secondary">Delete</button></td>
    </tr>`).join("");
  $("expensesList").innerHTML = `
    <div class="history-list"><table>
      <thead><tr><th>Name</th><th>Date</th><th>Amount</th><th style="width:100px">Actions</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="muted">No expenses in this range.</td></tr>'}</tbody>
    </table></div>`;
  $("expensesList").querySelectorAll("button[data-act='del']").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id=btn.getAttribute("data-id");
      const i=state.expenses.findIndex(e=>String(e.id)===String(id));
      if (i>=0 && confirm("Delete this expense?")){ state.expenses.splice(i,1); saveExpenses(); renderProfit(); }
    });
  });
}
function renderProfit(){
  if (!has("profitCard") || $("profitCard").style.display==="none") return;
  const rangeVal = val("profitRange") || "last30";
  const incomes = paidInvoicesInRange(rangeVal);
  const incomeTotal = sum(incomes, inv => computeTotalsFrom(inv).total);
  renderExpensesBreakdown(rangeVal);
  const expensesTotal = sum(expensesInRange(rangeVal), e=>e.amount);
  const profit = incomeTotal - expensesTotal;
  if (has("profitTotalBtn")){
    const btn=$("profitTotalBtn");
    btn.textContent = (profit<0?"-":"") + money(Math.abs(profit));
    btn.style.color = profit>=0 ? "#1b5e20" : "#b00020";
  }
  if (has("profitRangeLabel")) $("profitRangeLabel").textContent = ($("#profitRange")?.selectedOptions?.[0]?.textContent || "range");
}
function showProfitScreen(show){
  if (!has("profitCard")) return;
  $("profitCard").style.display = show ? "block" : "none";
  if (show){ fillProfitRange(); renderProfit(); setVal("expDate", toISO(new Date())); }
}
function showProfitDetails(show){
  if (!has("profitDetailsCard")) return;
  $("profitDetailsCard").style.display = show ? "block" : "none";
  if (show){
    const rv = val("profitRange") || "last30";
    if (has("profitRangeLabel")) $("profitRangeLabel").textContent = ($("#profitRange")?.selectedOptions?.[0]?.textContent || "range");
    const paid = paidInvoicesInRange(rv);
    const rows = paid.map(inv=>{
      const {total}=computeTotalsFrom(inv);
      const num=escapeHtml(inv.invoice?.number||"");
      const date=escapeHtml(inv.invoice?.date||"");
      const client=escapeHtml(inv.client?.name||"");
      return `<tr>
        <td>${num}</td><td>${date}</td><td>${client}</td><td>${money(total)}</td>
        <td class="row-actions"><button data-num="${num}" data-act="open">Open</button></td>
      </tr>`;
    }).join("");
    if (has("profitDetailsList")){
      $("profitDetailsList").innerHTML = `
        <div class="history-list"><table>
          <thead><tr><th>Invoice #</th><th>Date</th><th>Client</th><th>Total</th><th style="width:120px">Actions</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="muted">No paid invoices in this range.</td></tr>'}</tbody>
        </table></div>`;
      $("profitDetailsList").querySelectorAll("button[data-act='open']").forEach(btn=>{
        btn.addEventListener("click",()=>{
          const num=btn.getAttribute("data-num");
          const inv=state.invoices.find(x=>(x.invoice?.number||"")===num);
          if (inv){ setInvoice(inv); showProfitDetails(false); showProfitScreen(false); }
        });
      });
    }
  }
}
function exportProfitRangeCsv(){
  const rv = val("profitRange") || "last30";
  const paid = paidInvoicesInRange(rv);
  const rows=[["Invoice #","Date","Client","Email","Phone","Total","Paid?"]];
  paid.forEach(inv=>{
    const {total}=computeTotalsFrom(inv);
    rows.push([inv.invoice?.number||"", inv.invoice?.date||"", inv.client?.name||"", inv.client?.email||"", inv.client?.phone||"", total.toFixed(2), "Yes"]);
  });
  rows.push([]); rows.push(["Expenses"]); rows.push(["Name","Date","Amount"]);
  expensesInRange(rv).forEach(e=> rows.push([e.name||"", e.date||"", Number(e.amount||0).toFixed(2)]));
  const label = ($("#profitRange")?.selectedOptions?.[0]?.textContent || "range").replace(/\s+/g,'_');
  downloadCsv(`profit_${label}.csv`, rows);
}

// ---------- Render (invoice preview) ----------
function render(){
  const {subtotal,discount,tax,total}=calcTotals();
  if (has("subtotal"))   $("subtotal").textContent=money(subtotal);
  if (has("discount"))   $("discount").textContent=money(discount);
  if (has("tax"))        $("tax").textContent=money(tax);
  if (has("grandTotal")) $("grandTotal").textContent=money(total);

  const inv=currentInvoice();
  localStorage.setItem("lastBiz.v1", JSON.stringify(inv.business));

  if (!has("preview")) return;

  const logoImg=inv.business.logo?`<img class="logo" src="${inv.business.logo}" alt="logo">`:"";
  const dateStr=inv.invoice.date || toISO(new Date());
  const rows=inv.items.map((it,i)=>`
    <tr><td>${i+1}. ${escapeHtml(it.description||"")}</td><td>${Number(it.qty||0)}</td><td>${money(it.price||0)}</td><td>${money((it.qty||0)*(it.price||0))}</td></tr>
  `).join("");

  $("preview").innerHTML=`
    <div id="previewDoc">
      <div class="header">
        <div><h1 style="margin:0">INVOICE</h1><div class="muted"># ${escapeHtml(inv.invoice.number||"")}</div></div>
        <div>${logoImg}</div>
      </div>
      <div style="display:flex;gap:20px;justify-content:space-between;align-items:flex-start;border-top:4px solid #2e7d32;padding-top:8px">
        <div><strong>${escapeHtml(inv.business.name||"")}</strong><br>${nl2br(escapeHtml(inv.business.addr||""))}<br>${escapeHtml(inv.business.email||"")} ${escapeHtml(inv.business.phone||"")}</div>
        <div><div><strong>Date:</strong> ${escapeHtml(dateStr)}</div><div><strong>Due:</strong> ${escapeHtml(inv.invoice.due||"")}</div></div>
      </div>
      <div style="margin-top:10px"><strong style="color:#2e7d32">Bill To:</strong><br>${escapeHtml(inv.client.name||"")}<br>${nl2br(escapeHtml(inv.client.addr||""))}<br>${escapeHtml(inv.client.email||"")} ${escapeHtml(inv.client.phone||"")}</div>
      <table>
        <thead style="background:#eaf4ec"><tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="muted">No items yet</td></tr>'}</tbody>
        <tfoot>
          <tr><td colspan="3" style="text-align:right">Subtotal</td><td>${money(subtotal)}</td></tr>
          <tr><td colspan="3" style="text-align:right">Discount (${Number(inv.invoice.discountRate||0)}%)</td><td>${money(discount)}</td></tr>
          <tr><td colspan="3" style="text-align:right">GST (${state.GST_RATE}%)</td><td>${money(tax)}</td></tr>
          <tr><td colspan="3" style="text-align:right;color:#2e7d32"><strong>Total</strong></td>
              <td style="color:#2e7d32"><strong>${money(total)}</strong>${state.paid?'<span style="color:#b00020;font-weight:bold;margin-left:8px">PAID</span>':""}</td></tr>
        </tfoot>
      </table>
    </div>
  `;
  if (has("markPaidBtn")) $("markPaidBtn").textContent = state.paid ? "Mark Unpaid" : "Mark Paid";
}

// ---------- Init / Events ----------
window.addEventListener("load", ()=>{
  try {
    const today = toISO(new Date());
    if (has("invDate"))   setVal("invDate", today);
    if (has("invNumber")) setVal("invNumber", "INV-" + Date.now().toString().slice(0,6));
    if (has("taxRate")) { setVal("taxRate", String(state.GST_RATE)); $("taxRate").setAttribute("disabled","disabled"); }

    on("addItemBtn","click",()=>addItem());
    renderPresetButtons(); wirePresetForm();

    on("loadInvoiceBtn","click",()=>showHistory(true));
    on("historyClose","click",()=>showHistory(false));
    on("historySearch","input",(e)=>renderHistoryList(e.target.value));

    on("saveCustomerBtn","click",saveCurrentAsCustomer);
    on("openCustomersBtn","click",()=>showCustomers(true));
    on("openCustomersInlineBtn","click",()=>showCustomers(true));
    on("customersClose","click",()=>showCustomers(false));
    on("customerSearch","input",(e)=>renderCustomersList(e.target.value));

    on("profitBtn","click",()=>showProfitScreen(true));
    on("profitClose","click",()=>showProfitScreen(false));
    on("profitRange","change",renderProfit);
    on("profitTotalBtn","click",()=>showProfitDetails(true));
    on("profitDetailsBtn","click",()=>showProfitDetails(true));
    on("profitDetailsClose","click",()=>showProfitDetails(false));
    on("profitExportCsvBtn","click",exportProfitRangeCsv);

    if (has("expDate")) setVal("expDate", today);
    on("addExpenseBtn","click",()=>{
      const name=(val("expName")||"").trim();
      const amt=parseFloat(val("expAmount")||0);
      const date=val("expDate") || toISO(new Date());
      if (!name) return alert("Please enter a name.");
      if (!(amt>0)) return alert("Please enter a dollar amount.");
      state.expenses.unshift({ id: Date.now().toString(36), name, amount:amt, date });
      saveExpenses(); setVal("expName",""); setVal("expAmount","");
      renderProfit();
    });

    on("saveInvoiceBtn","click",()=>{
      const inv=currentInvoice();
      if (!inv.invoice.number) return alert("Please set an Invoice # first.");
      const i=state.invoices.findIndex(x=>x.invoice.number===inv.invoice.number);
      if (i>=0) state.invoices[i]=inv; else state.invoices.unshift(inv);
      saveInvoices(); alert("Saved locally."); renderProfit();
    });

    on("newInvoiceBtn","click",()=>{
      const biz=JSON.parse(localStorage.getItem("lastBiz.v1")||"{}");
      state.paid=false;
      setInvoice({
        business:{ name:biz.name||"Heavy Metal Medics", email:biz.email||"", phone:biz.phone||"", addr:biz.addr||"", logo:LOGO_SRC },
        invoice:{ number:"INV-"+Date.now().toString().slice(0,6), date:toISO(new Date()), due:"", currency:"$", taxRate:state.GST_RATE, discountRate:0, notes:"", terms:"" },
        client:{}, items:[], paid:false
      });
    });

    on("shareBtn","click",()=>window.print());

    on("markPaidBtn","click",()=>{
      state.paid=!state.paid; render();
      const inv=currentInvoice();
      if (inv.invoice.number){
        const i=state.invoices.findIndex(x=>x.invoice.number===inv.invoice.number);
        if (i>=0) state.invoices[i]=inv; else state.invoices.unshift(inv);
        saveInvoices(); renderProfit();
      }
      alert(state.paid ? "Invoice marked as PAID." : "Invoice marked as UNPAID.");
    });

    on("importJsonBtn","click",()=> $("importJsonInput")?.click());
    on("importJsonInput","change",(e)=>{
      const f=e.target.files?.[0]; if (!f) return;
      const reader=new FileReader();
      reader.onload=()=>{
        try{
          const data=JSON.parse(reader.result);
          if (Array.isArray(data)) state.invoices=data;
          else{
            if (Array.isArray(data.invoices)) state.invoices=data.invoices;
            if (Array.isArray(data.presets)) state.presets=data.presets;
            if (Array.isArray(data.customers)) state.customers=data.customers;
            if (Array.isArray(data.expenses)) state.expenses=data.expenses;
          }
          localStorage.setItem("invoices.v1", JSON.stringify(state.invoices));
          localStorage.setItem("presets.v1", JSON.stringify(state.presets));
          localStorage.setItem("customers.v1", JSON.stringify(state.customers));
          localStorage.setItem("expenses.v1", JSON.stringify(state.expenses));
          renderPresetButtons(); renderProfit(); alert("Imported.");
        }catch{ alert("Invalid JSON"); }
      };
      reader.readAsText(f);
    });
    on("exportJsonBtn","click",()=>{
      const blob=new Blob([JSON.stringify({ invoices:state.invoices, presets:state.presets, customers:state.customers, expenses:state.expenses }, null, 2)],{type:"application/json"});
      const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="invoices_backup.json"; a.click(); URL.revokeObjectURL(url);
    });
    on("exportCustomersCsvBtn","click",()=>{
      const rows=[["Name","Email","Phone","Address"]]; state.customers.forEach(c=>rows.push([c.name||"",c.email||"",c.phone||"", (c.addr||"").replace(/\n/g," ")])); downloadCsv("customers.csv",rows);
    });
    on("exportInvoicesCsvBtn","click",()=>{
      const rows=[["Invoice #","Date","Client","Email","Phone","Subtotal","Discount","GST","Total","Paid","Items"]];
      state.invoices.forEach(inv=>{
        const {subtotal,discount,tax,total}=computeTotalsFrom(inv);
        const itemsText=(inv.items||[]).map(it=>`${(it.description||"").replace(/,/g," ")} x${it.qty} @ ${it.price}`).join(" | ");
        rows.push([inv.invoice?.number||"", inv.invoice?.date||"", inv.client?.name||"", inv.client?.email||"", inv.client?.phone||"", subtotal.toFixed(2), discount.toFixed(2), tax.toFixed(2), total.toFixed(2), inv.paid?"Yes":"No", itemsText]);
      });
      downloadCsv("invoices.csv",rows);
    });

    ["bizName","bizEmail","bizPhone","bizAddr","invNumber","invDate","dueDate","currency","discountRate","notes","terms","clientName","clientEmail","clientPhone","clientAddr"].forEach(id=>{
      if (has(id)) $(id).addEventListener("input", render);
    });

    const lastBiz = JSON.parse(localStorage.getItem("lastBiz.v1") || "null");
    if (lastBiz) setInvoice({ business:lastBiz, invoice:{ date:toISO(new Date()), number:"INV-"+Date.now().toString().slice(0,6), currency:"$" }, items:[], paid:false });
    else render();

    if ("serviceWorker" in navigator) {
      // Normal registration (no unregister)
      navigator.serviceWorker.register("sw.js").catch(()=>{});
    }
  } catch (err) {
    // If anything slips through, show an inline notice so buttons don’t silently fail
    console.error(err);
    alert("Setup error: " + (err?.message || err));
  }
});
