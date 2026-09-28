/* Gap — app personal de gastos, deudas y plan de dinero.
   Todo se guarda en este teléfono (localStorage). Sin servidores. */
(() => {
'use strict';

// ---------- Constantes ----------
const KEY = 'gap.v1';
const TIPOS = {
  esencial: { n: 'Esencial', c: '#6FD6FF', e: '🏠' },
  capricho: { n: 'Capricho', c: '#FF8AD8', e: '✨' },
  deuda:    { n: 'Deuda',    c: '#A99BFF', e: '💳' },
  ahorro:   { n: 'Ahorro',   c: '#C8F560', e: '🌱' },
};
const QUE = [
  { id: 'comida', n: 'Comida', e: '🛒', t: 'esencial' },
  { id: 'transporte', n: 'Transporte', e: '🚌', t: 'esencial' },
  { id: 'servicios', n: 'Servicios', e: '💡', t: 'esencial' },
  { id: 'casa', n: 'Casa', e: '🏠', t: 'esencial' },
  { id: 'salud', n: 'Salud', e: '💊', t: 'esencial' },
  { id: 'trabajo', n: 'Trabajo', e: '💼', t: 'esencial' },
  { id: 'salidas', n: 'Salidas', e: '🍻', t: 'capricho' },
  { id: 'comer', n: 'Comer fuera', e: '🍔', t: 'capricho' },
  { id: 'ropa', n: 'Ropa', e: '👟', t: 'capricho' },
  { id: 'tech', n: 'Tecnología', e: '📱', t: 'capricho' },
  { id: 'regalos', n: 'Regalos', e: '🎁', t: 'capricho' },
  { id: 'otro', n: 'Otro', e: '🔹', t: 'esencial' },
];
const METODOS = ['Efectivo', 'Pago Móvil', 'Zelle', 'USDT', 'Tarjeta'];
const PLAN_KINDS = {
  fijo:     { n: 'Fijo mensual', c: '#6FD6FF', e: '🔁' },
  esencial: { n: 'Gasto grande', c: '#A99BFF', e: '📌' },
  capricho: { n: 'Capricho',     c: '#FF8AD8', e: '✨' },
  meta:     { n: 'Meta de ahorro', c: '#C8F560', e: '🎯' },
};
const LEVELS = [
  { max: .6,  c: '#C8F560', soft: 'rgba(200,245,96,.14)',  t: 'Vas muy bien' },
  { max: .85, c: '#FFB547', soft: 'rgba(255,181,71,.15)',  t: 'Ojo, baja el ritmo' },
  { max: 1,   c: '#FF7A59', soft: 'rgba(255,122,89,.16)',  t: 'Zona roja' },
  { max: 1e9, c: '#FF5E7A', soft: 'rgba(255,94,122,.16)',  t: 'Te pasaste del mes' },
];

// ---------- Estado ----------
const blank = () => ({
  v: 1,
  profile: null,
  tx: [],
  debts: [],
  plans: [],
  strategy: 'snowball',
  created: Date.now(),
});
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch { S = blank(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
// Gastos del día a día (v1.1): el pasaje viene listo por defecto
if (!Array.isArray(S.daily)) { S.daily = [{ id: 'pasaje', name: 'Pasaje', que: 'transporte', price: 300, cur: 'Bs', perDay: 2 }]; save(); }

// ---------- Utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const nf2 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = (v, dec) => (v < 0 ? '-$' : '$') + (dec ? nf2 : nf).format(Math.abs(round(v)));
const bs = v => 'Bs ' + nf.format(Math.round(v));
const round = v => Math.round(v * 100) / 100;
const pct = v => Math.round(v * 100) + '%';
const rate = () => S.profile?.rate || 1;
const toUSD = (amt, cur, r) => cur === 'Bs' ? amt / (r || rate()) : amt;
const mkey = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
const nowKey = () => mkey(Date.now());
const monthName = k => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('es-VE', { month: 'long' }); };
const addMonths = (k, n) => { const [y, m] = k.split('-').map(Number); return mkey(new Date(y, m - 1 + n, 1)); };
const dayLabel = ts => {
  const d = new Date(ts), t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Hoy';
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
};
const queById = id => QUE.find(q => q.id === id) || QUE[QUE.length - 1];
const daysIn = k => { const [y, m] = k.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const isToday = ts => new Date(ts).toDateString() === new Date().toDateString();
const itemUSD = it => toUSD(it.price, it.cur);            // un pasaje, a la tasa de hoy
const itemDayUSD = it => itemUSD(it) * it.perDay;         // estimado por día
const dailyMonthUSD = k => S.daily.reduce((a, it) => a + itemDayUSD(it), 0) * daysIn(k);
const money = (v, cur) => cur === 'Bs' ? bs(v) : usd(v, true);
const dailyForQue = que => S.daily.find(it => it.que === que);

function animateNum(el, to, f = usd, ms = 900) {
  if (!el) return;
  const from = +el.dataset.v || 0; el.dataset.v = to;
  const t0 = performance.now();
  const step = t => {
    const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
    el.textContent = f(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2200);
}

// ---------- Confeti ----------
function confetti(n = 110) {
  const cv = $('#confetti'), ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const cols = ['#C8F560', '#A99BFF', '#FF8AD8', '#6FD6FF', '#FFB547'];
  const ps = Array.from({ length: n }, () => ({
    x: innerWidth / 2, y: innerHeight * .45,
    vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4,
    r: Math.random() * 6 + 4, c: cols[Math.random() * cols.length | 0],
    a: Math.random() * 6, va: (Math.random() - .5) * .4,
  }));
  let f = 0;
  (function loop() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ps.forEach(p => {
      p.vy += .38; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
    });
    if (++f < 150) requestAnimationFrame(loop); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}

// ---------- Cálculos ----------
function monthTx(k = nowKey()) { return S.tx.filter(t => mkey(t.date) === k); }
function monthStats(k = nowKey()) {
  const txs = monthTx(k);
  const ingresos = txs.filter(t => t.type === 'ingreso').reduce((a, t) => a + t.usd, 0);
  const gastos = txs.filter(t => t.type === 'gasto');
  const byTipo = { esencial: 0, capricho: 0, deuda: 0, ahorro: 0 };
  gastos.forEach(t => byTipo[t.tipo] = (byTipo[t.tipo] || 0) + t.usd);
  const gastado = gastos.reduce((a, t) => a + t.usd, 0);
  const esperado = S.profile?.income || 0;
  const base = Math.max(ingresos, esperado);
  return { txs, ingresos, gastado, byTipo, base, esperado, libre: base - gastado, ratio: base ? gastado / base : (gastado ? 2 : 0) };
}
function level(ratio) { return LEVELS.find(l => ratio <= l.max); }
function applyLevel(ratio) {
  const l = level(ratio);
  document.documentElement.style.setProperty('--lvl', l.c);
  document.documentElement.style.setProperty('--lvl-soft', l.soft);
  $('meta[name=theme-color]').setAttribute('content', '#110F1A');
  return l;
}
const debtLeft = d => Math.max(0, d.total - d.paid);
function orderedDebts() {
  const act = S.debts.filter(d => debtLeft(d) > 0.009);
  return S.strategy === 'avalanche'
    ? act.sort((a, b) => (b.interest || 0) - (a.interest || 0) || debtLeft(a) - debtLeft(b))
    : act.sort((a, b) => debtLeft(a) - debtLeft(b));
}
function payoffPlan() {
  const budget = S.profile?.debtBudget || 0;
  const list = orderedDebts();
  if (!budget || !list.length) return null;
  let month = 0; const out = [];
  let rem = list.map(d => ({ d, left: debtLeft(d) }));
  // Método simple: todo el presupuesto va a la deuda prioritaria, en orden.
  let carry = 0;
  rem.forEach(r => {
    const need = r.left - carry; carry = 0;
    const m = need <= 0 ? 0 : Math.ceil(need / budget);
    month += m;
    carry = m * budget - need;
    out.push({ d: r.d, month });
  });
  return out;
}
function monthPlan(k) {
  const inc = S.profile?.income || 0;
  const items = S.plans.filter(p => p.kind === 'fijo' ? (!p.month || p.month <= k) : p.month === k);
  const dailyOut = dailyMonthUSD(k);
  const out = items.reduce((a, p) => a + p.amount, 0) + (S.profile?.debtBudget || 0) + dailyOut;
  return { inc, items, out, dailyOut, libre: inc - out };
}

// ---------- Navegación ----------
const TITLES = { home: 'Tu mes', debts: 'Tus deudas', plan: 'Tu plan', ideas: 'Oportunidades' };
let current = 'home';
function go(v) {
  current = v;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  $('#screenTitle').textContent = TITLES[v];
  $('#app').scrollTo({ top: 0 });
  render();
}
$$('.tab').forEach(t => t.addEventListener('click', () => go(t.dataset.view)));

function render() {
  const st = monthStats();
  applyLevel(st.ratio);
  const h = new Date().getHours();
  const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  $('#hello').textContent = `${saludo}${S.profile?.name ? ', ' + S.profile.name : ''}`;
  ({ home: renderHome, debts: renderDebts, plan: renderPlan, ideas: renderIdeas })[current](st);
}

// ---------- INICIO ----------
function renderHome(st) {
  const l = level(st.ratio);
  const C = 2 * Math.PI * 105;
  const frac = st.base ? Math.max(0, Math.min(1, st.libre / st.base)) : 0;
  // Presupuesto diario = (ingreso del mes − lo comprometido) ÷ días del mes.
  // Comprometido = fijos + gastos grandes del mes + abono a deudas + gastos diarios (pasajes…).
  const dim = daysIn(nowKey());
  const committed = monthPlan(nowKey()).out;
  const perDayFree = Math.max(0, st.base - committed) / dim;
  const spentTodayFree = S.tx.filter(t => t.type === 'gasto' && isToday(t.date) && !t.daily && (t.tipo === 'esencial' || t.tipo === 'capricho')).reduce((a, t) => a + t.usd, 0);
  const todayLeft = perDayFree - spentTodayFree;
  const capBudget = st.base * ((S.profile?.capPct ?? 15) / 100);
  const capLeft = capBudget - st.byTipo.capricho;
  const total = Object.values(st.byTipo).reduce((a, b) => a + b, 0) || 1;
  const recent = [...S.tx].sort((a, b) => b.date - a.date).slice(0, 8);

  $('#view-home').innerHTML = `
  <div class="stagger">
    <div class="hero">
      <div class="ring">
        <svg viewBox="0 0 250 250"><circle class="track" cx="125" cy="125" r="105" fill="none"/>
          <circle class="prog" cx="125" cy="125" r="105" fill="none" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>
        <div class="center">
          <div class="label">Libre este mes</div>
          <div class="amount num ${st.libre < 0 ? 'neg' : ''}" id="heroAmt">$0</div>
          <div class="sub">de ${usd(st.base)} · ${bs(st.libre * rate())}</div>
        </div>
      </div>
      <div class="mood"><span class="dot"></span>${l.t} · gastaste ${pct(Math.min(st.ratio, 9.99))}</div>
    </div>

    <div class="kpis">
      <div class="kpi"><div class="k">Puedes gastar hoy</div><div class="v num" style="color:${todayLeft < 0 ? 'var(--coral)' : 'inherit'}" id="kpiDay">$0</div><div class="k2">Libre por día: ${usd(perDayFree, true)}</div></div>
      <div class="kpi"><div class="k">Caprichos disponibles</div><div class="v num" style="color:${capLeft < 0 ? 'var(--coral)' : 'inherit'}" id="kpiCap">$0</div><div class="k2">Este mes</div></div>
    </div>

    <div class="card">
      <h3>Tu día a día <button class="link" id="dailyCfg">Ajustar</button></h3>
      ${S.daily.length ? S.daily.map(it => dailyCard(it, dim)).join('') : '<div class="muted small">Agrega gastos que haces todos los días, como el pasaje.</div>'}
      <div class="muted small" style="margin-top:6px">Tasa de hoy: ${nf.format(rate())} Bs/$</div>
    </div>

    <div class="card">
      <h3>¿A dónde se va?</h3>
      <div class="split">${Object.entries(TIPOS).map(([k, t]) => `<span data-w="${st.byTipo[k] / total * 100}" style="background:${t.c}"></span>`).join('')}</div>
      <div class="legend">${Object.entries(TIPOS).map(([k, t]) => `<div><i style="background:${t.c}"></i>${t.n}<b>${st.gastado ? pct(st.byTipo[k] / total) : '—'}</b></div>`).join('')}</div>
    </div>

    <div class="card">
      <h3>Movimientos <button class="link" id="seeAll">Ver todo</button></h3>
      ${recent.length ? recent.map(txRow).join('') : `<div class="empty"><div class="e">👆</div>Toca el botón <b>+</b> para registrar tu primer gasto o ingreso.</div>`}
    </div>
  </div>`;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const p = $('#view-home .prog'); if (p) p.style.strokeDashoffset = C * (1 - frac);
    $$('#view-home .split span, #view-home .bar span').forEach(s => s.style.width = s.dataset.w + '%');
  }));
  animateNum($('#heroAmt'), st.libre);
  animateNum($('#kpiDay'), todayLeft, v => usd(v, true));
  animateNum($('#kpiCap'), capLeft);
  $('#seeAll').onclick = openHistory;
  $('#dailyCfg').onclick = openDailyList;
  $$('[data-daily]').forEach(b => b.onclick = () => quickDaily(b.dataset.daily, b));
  bindTxRows($('#view-home'));
}

function dailyCard(it, dim) {
  const q = queById(it.que);
  const u = itemUSD(it), estDay = itemDayUSD(it), estMonth = estDay * dim;
  const txs = monthTx().filter(t => t.daily === it.id);
  const today = txs.filter(t => isToday(t.date)).reduce((a, t) => a + t.usd, 0);
  const month = txs.reduce((a, t) => a + t.usd, 0);
  const units = u ? Math.round(today / u * 10) / 10 : 0;
  const over = today > estDay + 0.001;
  return `<div class="daily">
    <div class="row">
      <div class="dic">${q.e}</div>
      <div class="grow"><div class="t">${esc(it.name)} · ${money(it.price, it.cur)}</div>
        <div class="s">≈ ${usd(u, true)} c/u · ${nf.format(it.perDay)} al día</div></div>
      <button class="plus" data-daily="${it.id}" aria-label="Registrar ${esc(it.name)}">+1</button>
    </div>
    <div class="dstats">
      <div><span>Estimado diario</span><b>${money(it.price * it.perDay, it.cur)}</b><small>≈ ${usd(estDay, true)}</small></div>
      <div><span>Hoy</span><b style="color:${over ? 'var(--coral)' : 'inherit'}">${nf.format(units)} de ${nf.format(it.perDay)}</b><small>${usd(today, true)}</small></div>
      <div><span>Este mes</span><b>${usd(month, true)}</b><small>de ${usd(estMonth)} est.</small></div>
    </div>
    <div class="bar thin"><span data-w="${estDay ? Math.min(100, today / estDay * 100) : 0}" style="${over ? 'background:var(--coral)' : ''}"></span></div>
  </div>`;
}

function quickDaily(id, btn) {
  const it = S.daily.find(x => x.id === id); if (!it) return;
  const q = queById(it.que);
  S.tx.push({ id: uid(), date: Date.now(), type: 'gasto', amount: it.price, cur: it.cur, rate: rate(),
    usd: round(itemUSD(it)), method: null, note: it.name, tipo: q.t, que: it.que, daily: it.id });
  save();
  const u = itemUSD(it);
  const today = S.tx.filter(t => t.daily === it.id && isToday(t.date)).reduce((a, t) => a + t.usd, 0);
  const n = u ? Math.round(today / u * 10) / 10 : 0;
  btn.classList.add('pop');
  setTimeout(() => { render(); toast(`${it.name} registrado · hoy ${nf.format(n)} de ${nf.format(it.perDay)}`); }, 180);
}

function openDailyList() {
  openSheet(`<h2>Tu día a día</h2>
    <p class="hint">Gastos que haces casi todos los días. Pon el precio como lo pagas (en Bs o $) y cuántas veces al día. Siempre te lo muestro convertido con la tasa de hoy (${nf.format(rate())} Bs/$).</p>
    <div class="card" style="padding:4px 16px">${S.daily.map(it => `<div class="set-row" data-ditem="${it.id}"><span>${queById(it.que).e} ${esc(it.name)} <span class="muted small">· ${nf.format(it.perDay)} al día</span></span><b class="num">${money(it.price, it.cur)}</b></div>`).join('') || '<div class="muted small" style="padding:14px 0">Nada todavía.</div>'}</div>
    <button class="btn block ghost" id="addDaily">+ Agregar gasto diario</button>`);
  $$('[data-ditem]').forEach(r => r.onclick = () => openDailyItem(r.dataset.ditem));
  $('#addDaily').onclick = () => openDailyItem();
}

function openDailyItem(id) {
  const it = S.daily.find(x => x.id === id);
  openSheet(`<h2>${it ? 'Editar' : 'Nuevo'} gasto diario</h2>
    <div class="field"><label>¿Qué es?</label><input id="iName" placeholder="Ej: Pasaje, café, almuerzo" value="${esc(it?.name)}"></div>
    <div class="field"><label>Categoría</label><select id="iQue">${QUE.map(q => `<option value="${q.id}" ${(it?.que || 'transporte') === q.id ? 'selected' : ''}>${q.e} ${q.n}</option>`).join('')}</select></div>
    <div class="grid2">
      <div class="field"><label>Precio de cada uno</label><input id="iPrice" inputmode="decimal" placeholder="0" value="${it ? it.price : ''}"></div>
      <div class="field"><label>Moneda</label><select id="iCur"><option ${it?.cur !== 'USD' ? 'selected' : ''}>Bs</option><option ${it?.cur === 'USD' ? 'selected' : ''}>USD</option></select></div>
    </div>
    <div class="field"><label>¿Cuántas veces al día?</label><input id="iPer" inputmode="decimal" placeholder="2" value="${it ? it.perDay : ''}"></div>
    <p class="hint" id="iPrev"></p>
    <button class="btn primary block" id="iSave">Guardar</button>
    ${it ? '<button class="btn block ghost danger" id="iDel" style="margin-top:10px">Eliminar</button>' : ''}`);
  const num = s => parseFloat(String(s).replace(',', '.')) || 0;
  const prev = () => {
    const p = num($('#iPrice').value), n = num($('#iPer').value) || 1, cur = $('#iCur').value;
    const dUSD = toUSD(p * n, cur);
    $('#iPrev').textContent = p ? `≈ ${money(p * n, cur)} al día (${usd(dUSD, true)}) · ≈ ${usd(dUSD * daysIn(nowKey()))} al mes con la tasa de hoy.` : '';
  };
  ['#iPrice', '#iPer'].forEach(s => $(s).oninput = prev); $('#iCur').onchange = prev; prev();
  $('#iSave').onclick = () => {
    const name = $('#iName').value.trim(), price = num($('#iPrice').value), perDay = num($('#iPer').value) || 1;
    if (!name || !price) return toast('Ponle nombre y precio');
    const obj = it || { id: uid() };
    Object.assign(obj, { name, que: $('#iQue').value, price, cur: $('#iCur').value, perDay });
    if (!it) S.daily.push(obj);
    save(); closeSheet(); render(); toast('Listo, ya lo estoy contando 🚌');
  };
  const del = $('#iDel'); if (del) del.onclick = () => { S.daily = S.daily.filter(x => x.id !== id); save(); openDailyList(); render(); };
}

function txRow(t) {
  const isIn = t.type === 'ingreso';
  const q = isIn ? null : queById(t.que);
  const color = isIn ? '#C8F560' : TIPOS[t.tipo]?.c || '#999';
  const emoji = isIn ? '💰' : (t.tipo === 'deuda' ? '💳' : t.tipo === 'ahorro' ? '🌱' : q.e);
  const title = t.note || (isIn ? (t.source || 'Ingreso') : t.tipo === 'deuda' ? 'Abono · ' + (S.debts.find(d => d.id === t.debtId)?.name || 'deuda') : t.tipo === 'ahorro' ? 'Ahorro' : q.n);
  const sub = [dayLabel(t.date), isIn ? t.source : TIPOS[t.tipo]?.n, t.method].filter(Boolean).join(' · ');
  const orig = t.cur === 'Bs' ? bs(t.amount) : '';
  return `<div class="tx" data-id="${t.id}">
    <div class="ic" style="background:${color}22">${emoji}</div>
    <div class="grow"><div class="t">${esc(title)}</div><div class="s">${esc(sub)}</div></div>
    <div class="a ${isIn ? 'in' : ''}">${isIn ? '+' : '-'}${usd(t.usd)}${orig ? `<small>${orig}</small>` : ''}</div>
  </div>`;
}
function bindTxRows(root) { $$('.tx', root).forEach(r => r.onclick = () => openTxDetail(r.dataset.id)); }

function openHistory() {
  const groups = {};
  [...S.tx].sort((a, b) => b.date - a.date).forEach(t => (groups[mkey(t.date)] ||= []).push(t));
  const keys = Object.keys(groups);
  openSheet(`<h2>Todos los movimientos</h2>${keys.length ? keys.map(k => {
    const s = monthStats(k);
    return `<div class="lbl" style="display:flex;justify-content:space-between"><span style="text-transform:capitalize">${monthName(k)} ${k.slice(0, 4)}</span><span>+${usd(s.ingresos)} / -${usd(s.gastado)}</span></div>
    <div class="card" style="padding:4px 16px">${groups[k].map(txRow).join('')}</div>`;
  }).join('') : '<div class="empty">Aún no hay movimientos.</div>'}`);
  bindTxRows($('#sheetBody'));
}

function openTxDetail(id) {
  const t = S.tx.find(x => x.id === id); if (!t) return;
  openSheet(`<h2>${t.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</h2>
    <div class="display"><div class="val num">${usd(t.usd, true)}</div>
    <div class="conv">${t.cur === 'Bs' ? bs(t.amount) + ' a tasa ' + nf.format(t.rate) : bs(t.usd * rate()) + ' a tasa de hoy'}</div></div>
    <div class="card">
      ${[['Fecha', new Date(t.date).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })],
         ['Tipo', t.type === 'ingreso' ? 'Ingreso · ' + (t.source || '') : TIPOS[t.tipo]?.n + (t.que ? ' · ' + queById(t.que).n : '')],
         ['Método', t.method || '—'], ['Nota', t.note || '—']]
         .map(([a, b]) => `<div class="set-row"><span class="muted">${a}</span><span>${esc(b)}</span></div>`).join('')}
    </div>
    <button class="btn block ghost danger" id="delTx">Eliminar movimiento</button>`);
  $('#delTx').onclick = () => {
    if (t.debtId) { const d = S.debts.find(x => x.id === t.debtId); if (d) d.paid = Math.max(0, d.paid - t.usd); }
    S.tx = S.tx.filter(x => x.id !== id); save(); closeSheet(); render(); toast('Movimiento eliminado');
  };
}

// ---------- REGISTRAR (+) ----------
function openAdd(preset = {}) {
  const f = { type: 'gasto', raw: '', cur: S.profile?.defCur || 'USD', que: null, tipo: null, method: null, source: null, note: '', debtId: null, ...preset };
  const sources = S.profile?.sources || [];
  const draw = () => {
    const amt = parseFloat(f.raw.replace(',', '.')) || 0;
    const conv = f.cur === 'Bs' ? '≈ ' + usd(amt / rate(), true) : amt ? '≈ ' + bs(amt * rate()) : '';
    openSheet(`
      <div class="toggle">
        <button class="${f.type === 'gasto' ? 'on g' : ''}" data-type="gasto">Gasto</button>
        <button class="${f.type === 'ingreso' ? 'on i' : ''}" data-type="ingreso">Ingreso</button>
      </div>
      <div class="display">
        <div class="val num" id="val">${f.cur === 'Bs' ? 'Bs ' : '$'}${f.raw || '0'}</div>
        <div class="conv" id="conv">${conv}</div>
        <div class="cur"><button data-cur="USD" class="${f.cur === 'USD' ? 'on' : ''}">USD</button><button data-cur="Bs" class="${f.cur === 'Bs' ? 'on' : ''}">Bs</button></div>
      </div>
      <div class="keypad">${['1','2','3','4','5','6','7','8','9',',','0','⌫'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div>
      ${f.type === 'gasto' ? `
        <div class="lbl">¿En qué?</div>
        <div class="chips" id="que">${QUE.map(q => `<button class="chip ${f.que === q.id ? 'on' : ''}" data-que="${q.id}">${q.e} ${q.n}</button>`).join('')}</div>
        <div class="lbl">Tipo de gasto</div>
        <div class="chips">${Object.entries(TIPOS).map(([k, t]) => `<button class="chip ${f.tipo === k ? 'on' : ''}" style="--c:${t.c}" data-tipo="${k}">${t.e} ${t.n}</button>`).join('')}</div>
        ${f.tipo === 'deuda' && S.debts.some(d => debtLeft(d) > 0) ? `<div class="lbl">¿A cuál deuda?</div>
        <div class="chips">${S.debts.filter(d => debtLeft(d) > 0).map(d => `<button class="chip ${f.debtId === d.id ? 'on' : ''}" data-debt="${d.id}">${esc(d.name)}</button>`).join('')}</div>` : ''}
      ` : `
        <div class="lbl">¿De dónde viene?</div>
        <div class="chips">${sources.map(s => `<button class="chip ${f.source === s ? 'on' : ''}" style="--c:#C8F560" data-src="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      `}
      <div class="lbl">Método</div>
      <div class="chips">${METODOS.map(m => `<button class="chip ${f.method === m ? 'on' : ''}" data-met="${m}">${m}</button>`).join('')}</div>
      <div class="field"><input id="note" placeholder="Nota (opcional)" value="${esc(f.note)}" maxlength="60"></div>
      <div class="sticky-save"><button class="btn primary block" id="saveTx">Guardar</button></div>`, f.redraw);

    const b = $('#sheetBody');
    $$('[data-type]', b).forEach(x => x.onclick = () => { f.type = x.dataset.type; f.note = $('#note').value; f.redraw = true; draw(); });
    $$('[data-cur]', b).forEach(x => x.onclick = () => { f.cur = x.dataset.cur; f.note = $('#note').value; f.redraw = true; draw(); });
    $$('[data-que]', b).forEach(x => x.onclick = () => { f.que = x.dataset.que; if (!f.tipoManual) f.tipo = queById(f.que).t; f.note = $('#note').value; f.redraw = true; draw(); });
    $$('[data-tipo]', b).forEach(x => x.onclick = () => { f.tipo = x.dataset.tipo; f.tipoManual = true; f.note = $('#note').value; f.redraw = true; draw(); });
    $$('[data-debt]', b).forEach(x => x.onclick = () => { f.debtId = x.dataset.debt; f.note = $('#note').value; f.redraw = true; draw(); });
    $$('[data-src]', b).forEach(x => x.onclick = () => { f.source = x.dataset.src; f.note = $('#note').value; f.redraw = true; draw(); });
    $$('[data-met]', b).forEach(x => x.onclick = () => { f.method = x.dataset.met; f.note = $('#note').value; f.redraw = true; draw(); });
    $$('[data-k]', b).forEach(x => x.onclick = () => {
      const k = x.dataset.k;
      if (k === '⌫') f.raw = f.raw.slice(0, -1);
      else if (k === ',') { if (!f.raw.includes(',')) f.raw = (f.raw || '0') + ','; }
      else if (f.raw.length < 10 && !(f.raw.includes(',') && f.raw.split(',')[1].length >= 2)) f.raw = (f.raw === '0' ? '' : f.raw) + k;
      const a = parseFloat(f.raw.replace(',', '.')) || 0;
      const v = $('#val'); v.textContent = (f.cur === 'Bs' ? 'Bs ' : '$') + (f.raw || '0');
      v.classList.remove('bump'); void v.offsetWidth; v.classList.add('bump');
      $('#conv').textContent = f.cur === 'Bs' ? '≈ ' + usd(a / rate(), true) : a ? '≈ ' + bs(a * rate()) : '';
    });
    $('#saveTx').onclick = () => {
      const amount = parseFloat(f.raw.replace(',', '.')) || 0;
      if (!amount) { $('#val').classList.add('shake'); setTimeout(() => $('#val')?.classList.remove('shake'), 400); return toast('Escribe un monto'); }
      if (f.type === 'gasto' && !f.tipo) f.tipo = f.que ? queById(f.que).t : 'esencial';
      const t = {
        id: uid(), date: Date.now(), type: f.type, amount, cur: f.cur, rate: rate(),
        usd: round(toUSD(amount, f.cur)), method: f.method, note: $('#note').value.trim(),
      };
      if (f.type === 'gasto') { t.tipo = f.tipo; t.que = f.que; if (f.tipo === 'deuda' && f.debtId) t.debtId = f.debtId; const di = dailyForQue(f.que); if (di && f.tipo !== 'deuda' && f.tipo !== 'ahorro') t.daily = di.id; }
      else t.source = f.source || 'Otro';
      S.tx.push(t);
      let party = f.type === 'ingreso' || t.tipo === 'ahorro';
      let msg = f.type === 'ingreso' ? '¡Entró dinero! 💰' : t.tipo === 'ahorro' ? '¡Bien! Eso es ahorro 🌱' : 'Gasto registrado';
      if (t.debtId) {
        const d = S.debts.find(x => x.id === t.debtId);
        d.paid = round(d.paid + t.usd);
        if (debtLeft(d) <= 0.009) { party = true; msg = `¡Liquidaste ${d.name}! 🎉`; }
        else msg = `Abono a ${d.name}: te faltan ${usd(debtLeft(d))}`;
      }
      save(); closeSheet(); render(); toast(msg);
      if (party) setTimeout(() => confetti(t.debtId ? 180 : 80), 250);
    };
  };
  draw();
}
$('#fab').addEventListener('click', () => openAdd());

// ---------- DEUDAS ----------
function renderDebts() {
  const list = orderedDebts();
  const done = S.debts.filter(d => debtLeft(d) <= 0.009);
  const totalLeft = list.reduce((a, d) => a + debtLeft(d), 0);
  const totalAll = S.debts.reduce((a, d) => a + d.total, 0) || 1;
  const paidAll = S.debts.reduce((a, d) => a + Math.min(d.paid, d.total), 0);
  const plan = payoffPlan();
  const whenIdx = Object.fromEntries((plan || []).map(p => [p.d.id, p.month]));
  const whenTxt = m => m <= 0 ? 'este mes' : m === 1 ? 'en 1 mes' : `en ${m} meses (${monthName(addMonths(nowKey(), m))})`;

  $('#view-debts').innerHTML = `<div class="stagger">
    <div class="debt-total">
      <div class="muted small">Te falta por pagar</div>
      <div class="amount num" id="debtAmt">$0</div>
      <div class="muted small">${S.debts.length ? `Llevas ${pct(paidAll / totalAll)} pagado · ${bs(totalLeft * rate())}` : 'Sin deudas registradas'}</div>
      ${S.debts.length ? `<div class="bar" style="max-width:260px;margin:12px auto 0"><span data-w="${paidAll / totalAll * 100}"></span></div>` : ''}
    </div>
    <div class="seg">
      <button data-str="snowball" class="${S.strategy === 'snowball' ? 'on' : ''}">⛄ Bola de nieve</button>
      <button data-str="avalanche" class="${S.strategy === 'avalanche' ? 'on' : ''}">🏔️ Avalancha</button>
    </div>
    <p class="hint">${S.strategy === 'snowball'
      ? '<b>Bola de nieve:</b> pagas primero la deuda más pequeña. Ganas victorias rápidas y motivación.'
      : '<b>Avalancha:</b> pagas primero la que cobra más interés. Pagas menos dinero en total.'}
      ${S.profile?.debtBudget ? ` Con ${usd(S.profile.debtBudget)}/mes para deudas:` : ' <a href="#" id="setBudget" style="color:var(--lvl)">Define cuánto puedes abonar al mes</a> para ver cuándo terminas.'}</p>
    ${list.map((d, i) => `
      <div class="debt ${i === 0 ? 'first' : ''}">
        ${i === 0 ? '<span class="tag">ATACA ESTA</span>' : ''}
        <div class="name">${esc(d.name)}</div>
        <div class="muted small">${[d.creditor, d.interest ? d.interest + '% interés' : '', d.due ? 'vence ' + new Date(d.due + 'T12:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }) : ''].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</div>
        <div class="bar"><span data-w="${Math.min(100, d.paid / d.total * 100)}"></span></div>
        <div class="row small"><span class="grow"><b class="num">${usd(debtLeft(d))}</b> <span class="muted">de ${usd(d.total)}</span></span>
          <span class="muted">${pct(d.paid / d.total)}</span></div>
        ${whenIdx[d.id] !== undefined ? `<div class="small" style="margin-top:6px;color:var(--lvl)">Libre ${whenTxt(whenIdx[d.id])}</div>` : ''}
        <div class="actions"><button class="btn primary" data-pay="${d.id}">Abonar</button><button class="btn ghost" data-edit="${d.id}">Editar</button></div>
      </div>`).join('')}
    ${!S.debts.length ? `<div class="empty"><div class="e">🕊️</div>Registra tus deudas y te digo cuál atacar primero.</div>` : ''}
    <button class="btn block ghost" id="addDebt" style="margin-top:4px">+ Agregar deuda</button>
    ${done.length ? `<div class="card" style="margin-top:14px"><h3>Liquidadas 🏆</h3>${done.map(d => `<div class="set-row"><span>✅ ${esc(d.name)}</span><span class="muted num">${usd(d.total)}</span></div>`).join('')}</div>` : ''}
  </div>`;
  animateNum($('#debtAmt'), totalLeft);
  requestAnimationFrame(() => requestAnimationFrame(() => $$('#view-debts .bar span').forEach(s => s.style.width = s.dataset.w + '%')));
  $$('[data-str]').forEach(b => b.onclick = () => { S.strategy = b.dataset.str; save(); render(); });
  $$('[data-pay]').forEach(b => b.onclick = () => openAdd({ type: 'gasto', tipo: 'deuda', tipoManual: true, debtId: b.dataset.pay }));
  $$('[data-edit]').forEach(b => b.onclick = () => openDebt(b.dataset.edit));
  $('#addDebt').onclick = () => openDebt();
  const sb = $('#setBudget'); if (sb) sb.onclick = e => { e.preventDefault(); openSettings(); };
}

function openDebt(id) {
  const d = S.debts.find(x => x.id === id);
  openSheet(`<h2>${d ? 'Editar deuda' : 'Nueva deuda'}</h2>
    <div class="field"><label>¿Qué es?</label><input id="dName" placeholder="Ej: Préstamo, Cashea, tarjeta" value="${esc(d?.name)}"></div>
    <div class="field"><label>¿A quién le debes?</label><input id="dCred" placeholder="Opcional" value="${esc(d?.creditor)}"></div>
    <div class="grid2">
      <div class="field"><label>Monto total</label><input id="dTotal" inputmode="decimal" placeholder="0" value="${d ? d.total : ''}"></div>
      <div class="field"><label>Moneda</label><select id="dCur"><option>USD</option><option>Bs</option></select></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Ya pagado ($)</label><input id="dPaid" inputmode="decimal" placeholder="0" value="${d ? d.paid : ''}"></div>
      <div class="field"><label>Interés % mes</label><input id="dInt" inputmode="decimal" placeholder="0" value="${d?.interest || ''}"></div>
    </div>
    <div class="field"><label>Fecha límite</label><input id="dDue" type="date" value="${d?.due || ''}"></div>
    <button class="btn primary block" id="dSave">${d ? 'Guardar cambios' : 'Agregar deuda'}</button>
    ${d ? '<button class="btn block ghost danger" id="dDel" style="margin-top:10px">Eliminar deuda</button>' : ''}`);
  $('#dSave').onclick = () => {
    const num = s => parseFloat(String(s).replace(',', '.')) || 0;
    const name = $('#dName').value.trim(); const raw = num($('#dTotal').value);
    if (!name || !raw) return toast('Ponle nombre y monto');
    const total = round(toUSD(raw, $('#dCur').value));
    const obj = d || { id: uid(), created: Date.now() };
    Object.assign(obj, { name, creditor: $('#dCred').value.trim(), total, paid: Math.min(total, num($('#dPaid').value)), interest: num($('#dInt').value), due: $('#dDue').value });
    if (!d) S.debts.push(obj);
    save(); closeSheet(); render(); toast(d ? 'Deuda actualizada' : 'Deuda agregada. ¡A por ella!');
  };
  const del = $('#dDel'); if (del) del.onclick = () => { S.debts = S.debts.filter(x => x.id !== id); save(); closeSheet(); render(); toast('Deuda eliminada'); };
}

// ---------- PLAN ----------
let planSel = null;
function renderPlan() {
  const start = nowKey();
  const months = Array.from({ length: 6 }, (_, i) => addMonths(start, i));
  planSel ||= start;
  const mp = monthPlan(planSel);
  const maxInc = Math.max(1, ...months.map(k => monthPlan(k).inc));
  const capBudget = (S.profile?.income || 0) * ((S.profile?.capPct ?? 15) / 100);
  const metas = S.plans.filter(p => p.kind === 'meta');

  $('#view-plan').innerHTML = `<div class="stagger">
    <p class="hint">Así se ven tus próximos 6 meses si cobras ${usd(S.profile?.income || 0)} al mes. Toca un mes para ver el detalle.</p>
    <div class="months">${months.map(k => {
      const p = monthPlan(k); const r = p.inc ? p.out / p.inc : 1; const l = level(r);
      return `<button class="month ${k === planSel ? 'on' : ''}" data-m="${k}">
        <div class="m">${monthName(k)}</div>
        <div class="v num" style="color:${p.libre < 0 ? 'var(--coral)' : 'inherit'}">${usd(p.libre)}</div>
        <div class="mini"><span style="width:${Math.min(100, r * 100)}%;background:${l.c}"></span></div>
        <div class="muted small" style="margin-top:4px">libre</div></button>`;
    }).join('')}</div>

    <div class="card">
      <h3><span style="text-transform:capitalize">${monthName(planSel)}</span><span class="num" style="color:var(--text);text-transform:none;letter-spacing:0">${usd(mp.libre)} libre</span></h3>
      <div class="set-row"><span>💰 Ingreso esperado</span><b class="num">${usd(mp.inc)}</b></div>
      ${S.profile?.debtBudget ? `<div class="set-row"><span>💳 Abono a deudas</span><b class="num">-${usd(S.profile.debtBudget)}</b></div>` : ''}
      ${mp.dailyOut ? `<div class="set-row"><span>🚌 Día a día <span class="muted small">· ${esc(S.daily.map(d => d.name).join(', '))}</span></span><b class="num">-${usd(mp.dailyOut)}</b></div>` : ''}
      ${mp.items.map(p => `<div class="set-row" data-plan="${p.id}"><span>${PLAN_KINDS[p.kind].e} ${esc(p.name)} <span class="muted small">${p.kind === 'fijo' ? '· cada mes' : ''}</span></span><b class="num">-${usd(p.amount)}</b></div>`).join('')}
      ${!mp.items.length ? '<div class="muted small" style="padding:12px 0">Nada planificado aún para este mes.</div>' : ''}
      <div class="set-row"><span class="muted">Libre por día</span><b class="num">${usd(Math.max(0, mp.libre) / daysIn(planSel), true)}</b></div>
      <div class="set-row" style="border:0"><span class="muted">Presupuesto de caprichos sugerido</span><b class="num" style="color:#FF8AD8">${usd(Math.max(0, Math.min(capBudget, mp.libre)))}</b></div>
      <button class="btn block ghost" id="addPlan" style="margin-top:6px">+ Planificar algo</button>
    </div>

    ${metas.length ? `<div class="card"><h3>Metas de ahorro 🎯</h3>${metas.map(m => {
      const saved = S.tx.filter(t => t.tipo === 'ahorro').reduce((a, t) => a + t.usd, 0);
      const monthsTo = Math.max(1, (() => { const [y1, m1] = start.split('-').map(Number); const [y2, m2] = m.month.split('-').map(Number); return (y2 - y1) * 12 + m2 - m1; })());
      return `<div style="margin-bottom:12px" data-plan="${m.id}"><div class="row"><b class="grow">${esc(m.name)}</b><span class="num">${usd(m.amount)}</span></div>
        <div class="muted small">Para ${monthName(m.month)} · aparta ${usd(m.amount / monthsTo)} al mes (≈ ${usd(m.amount / monthsTo / 4.3)} por semana)</div>
        <div class="bar"><span data-w="${Math.min(100, saved / m.amount * 100)}"></span></div></div>`;
    }).join('')}<p class="muted small">El progreso usa todo lo que registras como <b>Ahorro</b>.</p></div>` : ''}
  </div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => $$('#view-plan .bar span').forEach(s => s.style.width = s.dataset.w + '%')));
  $$('[data-m]').forEach(b => b.onclick = () => { planSel = b.dataset.m; renderPlan(); });
  $$('[data-plan]').forEach(r => r.onclick = () => openPlan(r.dataset.plan));
  $('#addPlan').onclick = () => openPlan();
}

function openPlan(id) {
  const p = S.plans.find(x => x.id === id);
  const opts = Array.from({ length: 12 }, (_, i) => addMonths(nowKey(), i));
  let kind = p?.kind || 'esencial';
  openSheet(`<h2>${p ? 'Editar' : 'Planificar'}</h2>
    <div class="chips" id="kinds">${Object.entries(PLAN_KINDS).map(([k, v]) => `<button class="chip ${kind === k ? 'on' : ''}" style="--c:${v.c}" data-kind="${k}">${v.e} ${v.n}</button>`).join('')}</div>
    <p class="hint" id="kindHint"></p>
    <div class="field"><label>¿Qué es?</label><input id="pName" placeholder="Ej: Alquiler, regalo de cumpleaños, zapatos" value="${esc(p?.name)}"></div>
    <div class="grid2">
      <div class="field"><label>Monto</label><input id="pAmt" inputmode="decimal" placeholder="0" value="${p ? p.amount : ''}"></div>
      <div class="field"><label>Moneda</label><select id="pCur"><option>USD</option><option>Bs</option></select></div>
    </div>
    <div class="field"><label id="pMonthLbl">¿Para cuándo?</label><select id="pMonth">${opts.map(k => `<option value="${k}" ${p?.month === k ? 'selected' : ''}>${monthName(k)} ${k.slice(0, 4)}</option>`).join('')}</select></div>
    <button class="btn primary block" id="pSave">Guardar</button>
    ${p ? '<button class="btn block ghost danger" id="pDel" style="margin-top:10px">Eliminar</button>' : ''}`);
  const hints = {
    fijo: 'Se repite todos los meses desde el mes que elijas: alquiler, internet, teléfono, transporte…',
    esencial: 'Un gasto importante que ya sabes que viene: inscripción, reparación, un pago grande.',
    capricho: 'Algo que quieres darte. Planificarlo te deja disfrutarlo sin culpa.',
    meta: 'Dinero que quieres tener ahorrado para esa fecha. Te digo cuánto apartar por semana.',
  };
  const setKind = k => { kind = k; $$('[data-kind]').forEach(c => c.classList.toggle('on', c.dataset.kind === k)); $('#kindHint').textContent = hints[k]; $('#pMonthLbl').textContent = k === 'fijo' ? '¿Desde cuándo?' : k === 'meta' ? '¿Para cuándo lo quieres?' : '¿Para cuándo?'; };
  setKind(kind);
  $$('[data-kind]').forEach(c => c.onclick = () => setKind(c.dataset.kind));
  $('#pSave').onclick = () => {
    const name = $('#pName').value.trim(); const raw = parseFloat($('#pAmt').value.replace(',', '.')) || 0;
    if (!name || !raw) return toast('Ponle nombre y monto');
    const obj = p || { id: uid() };
    Object.assign(obj, { name, kind, amount: round(toUSD(raw, $('#pCur').value)), month: $('#pMonth').value });
    if (!p) S.plans.push(obj);
    save(); closeSheet(); render(); toast('Plan guardado 📅');
  };
  const del = $('#pDel'); if (del) del.onclick = () => { S.plans = S.plans.filter(x => x.id !== id); save(); closeSheet(); render(); };
}

// ---------- IDEAS / OPORTUNIDADES ----------
function renderIdeas(st) {
  const ideas = [];
  const inc = st.base;
  const capPct = (S.profile?.capPct ?? 15) / 100;
  const savedAll = S.tx.filter(t => t.tipo === 'ahorro').reduce((a, t) => a + t.usd, 0);
  const esencialMes = st.byTipo.esencial || S.plans.filter(p => p.kind === 'fijo').reduce((a, p) => a + p.amount, 0);
  const debtsLeft = orderedDebts();
  const totalDebt = debtsLeft.reduce((a, d) => a + debtLeft(d), 0);

  // Puntaje de salud (0–100)
  const saveRate = inc ? st.byTipo.ahorro / inc : 0;
  const capRate = inc ? st.byTipo.capricho / inc : 0;
  let score = 50;
  score += Math.min(25, saveRate * 150);
  score -= Math.max(0, (capRate - capPct) * 120);
  score -= Math.max(0, (st.ratio - .85) * 60);
  score -= inc ? Math.min(20, totalDebt / inc * 8) : 0;
  score += st.libre > 0 ? 10 : -10;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const scoreCol = score >= 70 ? '#C8F560' : score >= 45 ? '#FFB547' : '#FF7A59';

  // AHORRO
  if (capRate > capPct && inc) ideas.push({ k: 'ahorro', e: '✂️', t: 'Tus caprichos van altos',
    p: `Llevas ${pct(capRate)} de tu ingreso en caprichos y tu límite es ${pct(capPct)}. Recortar la diferencia te libera ${usd(st.byTipo.capricho - inc * capPct)} este mes.` });
  const byQue = {};
  st.txs.filter(t => t.type === 'gasto' && t.que).forEach(t => byQue[t.que] = (byQue[t.que] || 0) + t.usd);
  const top = Object.entries(byQue).sort((a, b) => b[1] - a[1])[0];
  if (top && st.gastado) { const q = queById(top[0]); ideas.push({ k: 'ahorro', e: q.e, t: `Tu mayor fuga: ${q.n}`,
    p: `Es el ${pct(top[1] / st.gastado)} de lo que gastas este mes. Si lo bajas un 20%, ahorras ${usd(top[1] * .2)} al mes (${usd(top[1] * .2 * 12)} al año).` }); }
  if (inc && saveRate < .1) ideas.push({ k: 'ahorro', e: '🌱', t: 'Págate a ti primero',
    p: `Apenas cobres, aparta el 10% (${usd(inc * .1)}) y regístralo como Ahorro. Lo que no ves, no lo gastas.` });
  if (st.libre > 0 && new Date().getDate() > 20) ideas.push({ k: 'ahorro', e: '🏁', t: 'Cierra el mes ganando',
    p: `Te quedan ${usd(st.libre)} libres. Si mueves aunque sea el 50% a ahorro antes de fin de mes, lo conviertes en progreso real.` });

  // DEUDAS
  if (debtsLeft.length) {
    const d = debtsLeft[0];
    ideas.push({ k: 'deuda', e: '🎯', t: `Ataca primero: ${d.name}`,
      p: `Te faltan ${usd(debtLeft(d))}. Paga el mínimo en las demás y todo lo extra va aquí. ${S.profile?.debtBudget ? '' : 'Define un abono mensual en Ajustes para ver tu fecha de libertad.'}` });
    const withInt = debtsLeft.filter(x => x.interest > 0).sort((a, b) => b.interest - a.interest)[0];
    if (withInt) ideas.push({ k: 'deuda', e: '🔥', t: 'Una deuda te está cobrando caro',
      p: `${withInt.name} cobra ${withInt.interest}% al mes, eso es ≈ ${usd(debtLeft(withInt) * withInt.interest / 100)} mensuales solo en interés. Prioriza liquidarla.` });
  }

  // INVERSIÓN
  const fondoMeta = esencialMes * 3;
  if (esencialMes && savedAll < fondoMeta) ideas.push({ k: 'inversión', e: '🛟', t: 'Primero, tu colchón',
    p: `Antes de invertir, arma un fondo de emergencia de 3 meses de gastos esenciales (≈ ${usd(fondoMeta)}). Llevas ${pct(savedAll / fondoMeta)}. Guárdalo en dólares, no en bolívares.` });
  else if (savedAll > 0) ideas.push({ k: 'inversión', e: '📈', t: 'Pon a trabajar tu ahorro',
    p: `Ya tienes colchón. El excedente puede ir a algo que produzca: inventario para revender, equipo para tu negocio (como materiales para impresión 3D) o instrumentos en dólares. Compara riesgo y liquidez antes de decidir.` });
  ideas.push({ k: 'inversión', e: '🧰', t: 'La mejor inversión: lo que ya sabes hacer',
    p: 'Cada dólar en herramientas que te generan clientes (equipo, material, publicidad pequeña) suele rendir más que dejarlo quieto. Anótalo como gasto "Trabajo" y mide si se recupera.' });

  // GANAR MÁS
  const srcs = {};
  S.tx.filter(t => t.type === 'ingreso' && Date.now() - t.date < 90 * 864e5).forEach(t => srcs[t.source] = (srcs[t.source] || 0) + t.usd);
  const srcList = Object.entries(srcs).sort((a, b) => b[1] - a[1]);
  const srcTotal = srcList.reduce((a, [, v]) => a + v, 0);
  if (srcList.length) {
    const [n, v] = srcList[0];
    ideas.push({ k: 'ganar', e: '💡', t: srcList.length === 1 || v / srcTotal > .8 ? 'Dependes de una sola fuente' : `Tu motor principal: ${n}`,
      p: srcList.length === 1 || v / srcTotal > .8
        ? `${pct(v / srcTotal)} de lo que entra viene de ${n}. Una segunda fuente, aunque sea pequeña, te protege si esa falla.`
        : `En 90 días: ${srcList.map(([a, b]) => `${a} ${pct(b / srcTotal)}`).join(' · ')}. Mete más horas donde más rinde cada hora.` });
  }
  const earn = [
    ['📲', 'Consigue 1 cliente más para CeCe', 'Un solo negocio adicional con gestión mensual es ingreso recurrente. Ofrece un diagnóstico gratis a 3 negocios de tu zona esta semana.'],
    ['🖨️', 'Llaveros y merch con la impresora 3D', 'Arma un catálogo de 5 productos y ofrécelo a empresas y eventos. Pide el 50% por adelantado para no poner tu dinero.'],
    ['🍨', 'Monetiza tu oficio', 'Tortas o postres por encargo para fechas especiales, o talleres cortos. Tu experiencia en pastelería ya es un producto.'],
    ['🧾', 'Vende lo que no usas', 'Revisa ropa, tecnología o cosas guardadas. Lo que no usas en 6 meses puede ser efectivo hoy.'],
  ];
  earn.forEach(([e, t, p]) => ideas.push({ k: 'ganar', e, t, p }));

  const K = { ahorro: ['#C8F560', 'Ahorro'], deuda: ['#A99BFF', 'Deudas'], 'inversión': ['#6FD6FF', 'Inversión'], ganar: ['#FFB547', 'Ganar'] };
  $('#view-ideas').innerHTML = `<div class="stagger">
    <div class="card score">
      <div class="ring" style="width:96px;height:96px">
        <svg viewBox="0 0 250 250" style="width:96px;height:96px"><circle class="track" cx="125" cy="125" r="105" fill="none" style="stroke-width:26"/>
        <circle class="prog" id="scoreRing" cx="125" cy="125" r="105" fill="none" style="stroke:${scoreCol};stroke-width:26;filter:none" stroke-dasharray="660" stroke-dashoffset="660"/></svg>
        <div class="center"><div class="big num" id="scoreN" style="font-size:30px">0</div></div>
      </div>
      <div class="grow"><div class="lbl" style="margin:0">Salud financiera</div>
        <div style="font-weight:800;font-size:18px;margin:2px 0">${score >= 70 ? 'Vas fuerte 💪' : score >= 45 ? 'En camino' : 'Hay que ajustar'}</div>
        <div class="muted small">Mezcla de ahorro, caprichos, deudas y cuánto te queda libre.</div></div>
    </div>
    <div class="seg" id="ideaFilter">
      <button data-f="all" class="on">Todo</button>${Object.entries(K).map(([k, [, n]]) => `<button data-f="${k}">${n}</button>`).join('')}
    </div>
    <div id="ideaList">${ideas.map(i => `<div class="idea" data-k="${i.k}">
      <div class="em" style="background:${K[i.k][0]}22">${i.e}</div>
      <div><div class="kind" style="color:${K[i.k][0]}">${K[i.k][1]}</div><h4>${esc(i.t)}</h4><p>${esc(i.p)}</p></div></div>`).join('')}</div>
  </div>`;
  animateNum($('#scoreN'), score, v => Math.round(v));
  requestAnimationFrame(() => requestAnimationFrame(() => { const r = $('#scoreRing'); if (r) r.style.strokeDashoffset = 660 * (1 - score / 100); }));
  $$('#ideaFilter button').forEach(b => b.onclick = () => {
    $$('#ideaFilter button').forEach(x => x.classList.toggle('on', x === b));
    $$('#ideaList .idea').forEach(i => i.style.display = b.dataset.f === 'all' || i.dataset.k === b.dataset.f ? '' : 'none');
  });
}

// ---------- Hoja inferior ----------
function openSheet(html, keepScroll) {
  const body = $('#sheetBody'); const top = body.scrollTop;
  body.innerHTML = html;
  if (keepScroll) body.scrollTop = top; else body.scrollTop = 0;
  $('#sheet').classList.add('on'); $('#scrim').classList.add('on');
}
function closeSheet() {
  if (!S.profile) return; // la bienvenida no se cierra
  $('#sheet').classList.remove('on'); $('#scrim').classList.remove('on');
}
$('#scrim').addEventListener('click', closeSheet);
// Deslizar hacia abajo para cerrar
(() => {
  const sh = $('#sheet'); let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => { if ($('#sheetBody').scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  sh.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); if (dy > 0) { sh.style.transition = 'none'; sh.style.transform = `translateY(${dy}px)`; } }, { passive: true });
  sh.addEventListener('touchend', () => { sh.style.transition = ''; sh.style.transform = ''; if (dy > 110) closeSheet(); y0 = null; dy = 0; });
})();

// ---------- Ajustes ----------
function openSettings() {
  const p = S.profile;
  openSheet(`<h2>Ajustes</h2>
    <div class="field"><label>Tu nombre</label><input id="sName" value="${esc(p.name)}"></div>
    <div class="grid2">
      <div class="field"><label>Ingreso mensual ($)</label><input id="sInc" inputmode="decimal" value="${p.income || ''}"></div>
      <div class="field"><label>Tasa Bs por $</label><input id="sRate" inputmode="decimal" value="${p.rate || ''}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Caprichos (% ingreso)</label><input id="sCap" inputmode="numeric" value="${p.capPct ?? 15}"></div>
      <div class="field"><label>Abono deudas $/mes</label><input id="sDebt" inputmode="decimal" value="${p.debtBudget || ''}" placeholder="0"></div>
    </div>
    <div class="field"><label>Moneda al registrar</label><select id="sCur"><option ${p.defCur !== 'Bs' ? 'selected' : ''}>USD</option><option ${p.defCur === 'Bs' ? 'selected' : ''}>Bs</option></select></div>
    <div class="field"><label>Tus fuentes de ingreso (separadas por coma)</label><input id="sSrc" value="${esc((p.sources || []).join(', '))}"></div>
    <button class="btn primary block" id="sSave">Guardar</button>
    <div class="lbl" style="margin-top:22px">Tus datos</div>
    <p class="hint">Todo vive solo en este teléfono. Haz un respaldo de vez en cuando por si cambias de equipo.</p>
    <div class="grid2"><button class="btn" id="exp">⬇️ Respaldar</button><label class="btn" for="imp">⬆️ Restaurar</label></div>
    <input type="file" id="imp" accept="application/json,.json" hidden>
    <button class="btn block ghost danger" id="reset" style="margin-top:12px">Borrar todo y empezar de cero</button>
    <p class="muted small" style="text-align:center;margin-top:16px">Gap v1.1 · hecho para ti</p>`);
  const num = id => parseFloat($(id).value.replace(',', '.')) || 0;
  $('#sSave').onclick = () => {
    Object.assign(S.profile, {
      name: $('#sName').value.trim(), income: num('#sInc'), rate: num('#sRate') || p.rate,
      capPct: Math.max(0, Math.min(100, num('#sCap'))), debtBudget: num('#sDebt'), defCur: $('#sCur').value,
      sources: $('#sSrc').value.split(',').map(s => s.trim()).filter(Boolean),
    });
    save(); closeSheet(); render(); toast('Ajustes guardados');
  };
  $('#exp').onclick = async () => {
    const name = `gap-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Respaldo Gap' }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  };
  $('#imp').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => { const d = JSON.parse(t); if (!d.profile || !Array.isArray(d.tx)) throw 0; S = d; save(); closeSheet(); render(); toast('Datos restaurados ✅'); })
      .catch(() => toast('Ese archivo no es un respaldo de Gap'));
  };
  let armed = false;
  $('#reset').onclick = e => {
    if (!armed) { armed = true; e.target.textContent = 'Toca otra vez para confirmar'; return; }
    S = blank(); save(); location.reload();
  };
}
$('#btnSettings').addEventListener('click', openSettings);

// ---------- Tasa rápida: si la tasa tiene más de 3 días, recordar ----------
function checkRate() {
  const p = S.profile; if (!p) return;
  if (Date.now() - (p.rateAt || 0) > 3 * 864e5) {
    setTimeout(() => {
      openSheet(`<h2>¿Cómo está la tasa hoy?</h2>
        <p class="hint">Actualízala para que tus bolívares se conviertan bien. Última: <b>${nf.format(p.rate)} Bs/$</b>.</p>
        <div class="field"><input id="qRate" inputmode="decimal" value="${p.rate}" style="font-size:28px;font-weight:800;text-align:center"></div>
        <button class="btn primary block" id="qSave">Actualizar</button>
        <button class="btn block ghost" id="qSkip" style="margin-top:10px">Sigue igual</button>`);
      const done = () => { p.rateAt = Date.now(); save(); closeSheet(); render(); };
      $('#qSave').onclick = () => { const v = parseFloat($('#qRate').value.replace(',', '.')); if (v > 0) p.rate = v; done(); toast('Tasa actualizada'); };
      $('#qSkip').onclick = done;
    }, 900);
  }
}

// ---------- Bienvenida ----------
function welcome() {
  let step = 0; const d = { name: '', income: '', rate: '' };
  const logo = `<svg class="logo" viewBox="0 0 100 100"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C8F560"/><stop offset="1" stop-color="#A99BFF"/></linearGradient></defs>
    <circle cx="50" cy="50" r="36" fill="none" stroke="url(#lg)" stroke-width="14" stroke-linecap="round" stroke-dasharray="185 226" transform="rotate(-50 50 50)"/></svg>`;
  const steps = [
    () => `<div class="welcome">${logo}<h2>Hola, soy Gap</h2><p>La distancia entre lo que ganas y lo que gastas. Mi trabajo es que esa distancia crezca a tu favor.</p>
      <div class="field"><input id="w" placeholder="¿Cómo te llamas?" value="${esc(d.name)}" style="text-align:center;font-size:20px"></div>
      <button class="btn primary block" id="n">Empezar</button></div>`,
    () => `<div class="welcome"><div style="font-size:56px;margin-bottom:10px">💵</div><h2>¿Cuánto te entra al mes?</h2><p>Un aproximado en dólares, sumando todo. Lo puedes cambiar cuando quieras.</p>
      <div class="field"><input id="w" inputmode="decimal" placeholder="$ 0" value="${d.income}" style="text-align:center;font-size:30px;font-weight:800"></div>
      <button class="btn primary block" id="n">Siguiente</button></div>`,
    () => `<div class="welcome"><div style="font-size:56px;margin-bottom:10px">🔁</div><h2>¿A cuánto está el dólar?</h2><p>Bolívares por cada dólar, la tasa que tú usas. Te lo preguntaré cada pocos días.</p>
      <div class="field"><input id="w" inputmode="decimal" placeholder="Bs por $" value="${d.rate}" style="text-align:center;font-size:30px;font-weight:800"></div>
      <button class="btn primary block" id="n">Listo, vamos</button></div>`,
  ];
  const draw = () => {
    openSheet(steps[step]());
    const w = $('#w');
    const next = () => {
      const v = w.value.trim();
      if (step === 0) { if (!v) return w.classList.add('shake'); d.name = v; }
      if (step === 1) { d.income = parseFloat(v.replace(',', '.')) || 0; }
      if (step === 2) {
        d.rate = parseFloat(v.replace(',', '.')) || 0;
        if (!d.rate) { w.classList.remove('shake'); void w.offsetWidth; return w.classList.add('shake'); }
        S.profile = { name: d.name, income: d.income, rate: d.rate, rateAt: Date.now(), capPct: 15, debtBudget: 0, defCur: 'USD',
          sources: ['Sueldo', 'CeCe', 'Impresión 3D', 'Extra'] };
        save(); closeSheet(); render(); confetti(); toast(`¡Bienvenido, ${d.name}! 🎉`); return;
      }
      step++; draw();
    };
    $('#n').onclick = next;
    w.onkeydown = e => { if (e.key === 'Enter') next(); };
  };
  draw();
}

// ---------- Arranque ----------
render();
if (!S.profile) welcome(); else checkRate();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.profile) render(); });
})();
