/* ══════════════════════════════════════
   KHARCHA — Expense Tracker App Logic
   ══════════════════════════════════════ */

/* ── State ── */
let transactions = JSON.parse(localStorage.getItem('kharcha_txns') || '[]')
  .map(t => ({ ...t, date: new Date(t.date) }));

let budgets = JSON.parse(localStorage.getItem('kharcha_budgets') || '{}');

let currentType = 'income';
let sortField = 'date';
let sortDir = -1; // -1 = desc, 1 = asc
let filteredTxns = [];

let barChartInst   = null;
let donutChartInst = null;
let lineChartInst  = null;
let hbarChartInst  = null;

const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAT_EMOJIS = {
  Salary:'💼', Freelance:'💻', Business:'🏢', Gift:'🎁', 'Other Income':'💰',
  Food:'🍽', Transport:'🚗', Bills:'📄', Rent:'🏠', Shopping:'🛍',
  Health:'🏥', Education:'📚', Entertainment:'🎬', Savings:'🐖', Other:'📦', General:'📌'
};

const CAT_COLORS = [
  '#4f46e5','#16a34a','#dc2626','#d97706','#0891b2',
  '#7c3aed','#db2777','#059669','#ea580c','#0284c7',
];

/* ── Save ── */
function save() {
  localStorage.setItem('kharcha_txns', JSON.stringify(transactions));
}

/* ── Helpers ── */
function fmt(n)  { return 'Rs ' + Math.abs(Math.round(n)).toLocaleString(); }
function fmtS(n) { return (n < 0 ? '−' : '') + fmt(n); }

function getMonthTxns(date) {
  const m = date.getMonth(), y = date.getFullYear();
  return transactions.filter(t => t.date.getMonth() === m && t.date.getFullYear() === y);
}

function totals(list) {
  const inc = list.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const exp = list.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { inc, exp, bal: inc - exp };
}

function catMap(list) {
  const map = {};
  list.filter(t => t.type === 'expense').forEach(t => {
    map[t.category] = (map[t.category] || 0) + t.amount;
  });
  return map;
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

/* ── Navigation ── */
function showPage(name, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');
  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.querySelector('.sidebar-overlay')?.classList.remove('active');
  // Render relevant page
  if (name === 'dashboard')    renderDashboard();
  if (name === 'transactions') renderTransactions();
  if (name === 'budget')       renderBudget();
  if (name === 'reports')      renderReports();
  if (name === 'add')          renderAddQuickStats();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.querySelector('.sidebar-overlay').classList.toggle('active');
}

/* ── Set transaction type ── */
function setType(type) {
  currentType = type;
  document.getElementById('btn-income').classList.toggle('active', type === 'income');
  document.getElementById('btn-expense').classList.toggle('active', type === 'expense');
}

/* ── Add transaction ── */
function addTransaction() {
  const desc   = document.getElementById('f-desc').value.trim();
  const amt    = parseFloat(document.getElementById('f-amt').value);
  const date   = document.getElementById('f-date').value;
  const cat    = document.getElementById('f-cat').value;
  const note   = document.getElementById('f-note').value.trim();
  const errEl  = document.getElementById('form-error');

  if (!desc)       { showError(errEl, 'Please enter a description.'); return; }
  if (!amt || amt <= 0) { showError(errEl, 'Please enter a valid amount greater than 0.'); return; }
  if (!date)       { showError(errEl, 'Please select a date.'); return; }

  errEl.style.display = 'none';

  transactions.unshift({
    id: Date.now(),
    type: currentType,
    desc,
    amount: amt,
    category: cat,
    note,
    date: new Date(date + 'T12:00:00')
  });

  save();
  showToast(currentType === 'income' ? '✓ Income added' : '✓ Expense recorded');

  // Reset form
  document.getElementById('f-desc').value = '';
  document.getElementById('f-amt').value  = '';
  document.getElementById('f-note').value = '';
  renderAddQuickStats();

  // Check budget alert
  if (currentType === 'expense') checkBudgetAlert(cat);
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

function checkBudgetAlert(cat) {
  if (!budgets[cat]) return;
  const now = new Date();
  const monthExp = getMonthTxns(now)
    .filter(t => t.type === 'expense' && t.category === cat)
    .reduce((s, t) => s + t.amount, 0);
  const pct = monthExp / budgets[cat];
  if (pct >= 1)    showToast(`⚠️ ${cat} budget exceeded!`);
  else if (pct >= .8) showToast(`⚠️ ${cat} budget at ${Math.round(pct*100)}%`);
}

/* ── Delete transaction ── */
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  showToast('Transaction deleted');
  renderDashboard();
  renderTransactions();
  renderAddQuickStats();
}

/* ── Clear all ── */
function clearAll() {
  if (!confirm('Delete all transactions? This cannot be undone.')) return;
  transactions = [];
  save();
  showToast('All data cleared');
  renderDashboard();
  renderTransactions();
}

/* ── Dashboard ── */
function renderDashboard() {
  document.getElementById('current-month').textContent =
    MONTHS[new Date().getMonth()] + ' ' + new Date().getFullYear();

  const { inc, exp, bal } = totals(transactions);
  const incTxns = transactions.filter(t => t.type === 'income');
  const expTxns = transactions.filter(t => t.type === 'expense');

  document.getElementById('dash-balance').textContent = fmtS(bal);
  document.getElementById('dash-balance').style.color =
    bal < 0 ? 'var(--red)' : bal > 0 ? 'var(--green)' : '';
  document.getElementById('dash-balance-sub').textContent =
    transactions.length ? `${transactions.length} total transactions` : 'No transactions yet';

  document.getElementById('dash-income').textContent = fmt(inc);
  document.getElementById('dash-income-count').textContent = incTxns.length + ' transactions';

  document.getElementById('dash-expense').textContent = fmt(exp);
  document.getElementById('dash-expense-count').textContent = expTxns.length + ' transactions';

  const savings = inc > 0 ? Math.round((bal / inc) * 100) : 0;
  document.getElementById('dash-savings').textContent = savings + '%';
  document.getElementById('dash-savings').style.color =
    savings < 0 ? 'var(--red)' : savings > 20 ? 'var(--green)' : '';

  renderBarChart();
  renderDonutChart();
  renderRecentList();
}

function renderRecentList() {
  const list = document.getElementById('dash-recent-list');
  const recent = transactions.slice(0, 8);
  if (!recent.length) {
    list.innerHTML = '<p class="empty-msg">No transactions yet. <button class="link-btn" onclick="showPage(\'add\', document.querySelector(\'[data-page=add]\'))">Add one →</button></p>';
    return;
  }
  list.innerHTML = recent.map(t => `
    <div class="txn-row">
      <div class="txn-left">
        <div class="txn-dot ${t.type}">${CAT_EMOJIS[t.category] || '📌'}</div>
        <div>
          <div class="txn-desc">${escHtml(t.desc)}</div>
          <div class="txn-meta">${t.category} · ${MONTHS[t.date.getMonth()]} ${t.date.getDate()}, ${t.date.getFullYear()}</div>
        </div>
      </div>
      <div class="txn-amount ${t.type}">${t.type === 'income' ? '+' : '−'} ${fmt(t.amount)}</div>
    </div>`).join('');
}

/* ── Bar chart (dashboard) ── */
function renderBarChart() {
  const now = new Date();
  const labels = [], incData = [], expData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth(), y = d.getFullYear();
    labels.push(MONTHS[m]);
    const mt = transactions.filter(t => t.date.getMonth() === m && t.date.getFullYear() === y);
    const { inc, exp } = totals(mt);
    incData.push(Math.round(inc));
    expData.push(Math.round(exp));
  }

  if (barChartInst) barChartInst.destroy();
  barChartInst = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Income',   data: incData, backgroundColor: '#16a34a', borderRadius: 4, barPercentage: 0.55 },
        { label: 'Expenses', data: expData, backgroundColor: '#dc2626', borderRadius: 4, barPercentage: 0.55 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' Rs ' + ctx.parsed.y.toLocaleString() } }
      },
      scales: {
        x: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { display: false }, border: { display: false } },
        y: { ticks: { color: '#9ca3af', font: { size: 11 }, callback: v => 'Rs ' + v.toLocaleString() }, grid: { color: 'rgba(0,0,0,.05)' }, border: { display: false } }
      }
    }
  });
}

/* ── Donut chart ── */
function renderDonutChart() {
  const cm = catMap(transactions);
  const entries = Object.entries(cm).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  const legendEl = document.getElementById('donut-legend');

  if (!entries.length) {
    legendEl.innerHTML = '';
    if (donutChartInst) { donutChartInst.destroy(); donutChartInst = null; }
    return;
  }

  const colors = entries.map((_, i) => CAT_COLORS[i % CAT_COLORS.length]);

  if (donutChartInst) donutChartInst.destroy();
  donutChartInst = new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      labels: entries.map(([k]) => k),
      datasets: [{ data: entries.map(([, v]) => Math.round(v)), backgroundColor: colors, borderWidth: 2, borderColor: '#ffffff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: Rs ${ctx.parsed.toLocaleString()} (${Math.round(ctx.parsed/total*100)}%)` } }
      }
    }
  });

  legendEl.innerHTML = entries.map(([cat, val], i) => `
    <div class="donut-legend-item">
      <div class="donut-legend-dot" style="background:${colors[i]}"></div>
      <span>${cat} (${Math.round(val/total*100)}%)</span>
    </div>`).join('');
}

/* ── Transactions page ── */
function renderTransactions() {
  // Populate category filter
  const catSel = document.getElementById('filter-cat');
  const allCats = [...new Set(transactions.map(t => t.category))].sort();
  catSel.innerHTML = '<option value="all">All categories</option>' +
    allCats.map(c => `<option value="${c}">${c}</option>`).join('');
  applyFilters();
}

function applyFilters() {
  const type   = document.getElementById('filter-type').value;
  const cat    = document.getElementById('filter-cat').value;
  const search = document.getElementById('filter-search').value.toLowerCase();

  filteredTxns = transactions
    .filter(t => type === 'all' || t.type === type)
    .filter(t => cat  === 'all' || t.category === cat)
    .filter(t => !search || t.desc.toLowerCase().includes(search) || t.category.toLowerCase().includes(search));

  sortTransactions();
}

function sortBy(field) {
  if (sortField === field) sortDir *= -1;
  else { sortField = field; sortDir = -1; }
  document.getElementById('sort-date').textContent   = '↕';
  document.getElementById('sort-amount').textContent = '↕';
  document.getElementById('sort-' + field).textContent = sortDir === -1 ? '↓' : '↑';
  sortTransactions();
}

function sortTransactions() {
  filteredTxns = [...filteredTxns].sort((a, b) => {
    if (sortField === 'date')   return (a.date - b.date) * sortDir;
    if (sortField === 'amount') return (a.amount - b.amount) * sortDir;
    return 0;
  });
  renderTxnTable();
}

function renderTxnTable() {
  const tbody  = document.getElementById('txn-tbody');
  const empty  = document.getElementById('txn-empty');
  const sumBar = document.getElementById('txn-summary-bar');

  if (!filteredTxns.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    sumBar.innerHTML = '';
    return;
  }

  empty.style.display = 'none';

  const { inc, exp } = totals(filteredTxns);
  sumBar.innerHTML = `
    <span>${filteredTxns.length} transactions</span>
    <span style="color:var(--green)">Income: ${fmt(inc)}</span>
    <span style="color:var(--red)">Expenses: ${fmt(exp)}</span>
  `;

  tbody.innerHTML = filteredTxns.map(t => `
    <tr>
      <td>${MONTHS[t.date.getMonth()]} ${t.date.getDate()}, ${t.date.getFullYear()}</td>
      <td>
        <span style="font-weight:500">${escHtml(t.desc)}</span>
        ${t.note ? `<br><span style="font-size:11.5px;color:var(--ink-4)">${escHtml(t.note)}</span>` : ''}
      </td>
      <td><span class="cat-tag">${CAT_EMOJIS[t.category] || ''} ${t.category}</span></td>
      <td style="font-weight:600;color:${t.type==='income'?'var(--green)':'var(--red)'}">
        ${t.type==='income'?'+':'−'} ${fmt(t.amount)}
      </td>
      <td><span class="badge ${t.type}">${t.type === 'income' ? 'Income' : 'Expense'}</span></td>
      <td>
        <button class="del-btn-table" onclick="deleteTransaction(${t.id})" aria-label="Delete ${escHtml(t.desc)}">×</button>
      </td>
    </tr>`).join('');
}

function clearFilters() {
  document.getElementById('filter-type').value   = 'all';
  document.getElementById('filter-cat').value    = 'all';
  document.getElementById('filter-search').value = '';
  applyFilters();
}

/* ── Export CSV ── */
function exportCSV() {
  if (!transactions.length) { showToast('No transactions to export'); return; }
  const header = 'Date,Type,Description,Category,Amount,Note';
  const rows = transactions.map(t =>
    `"${t.date.toLocaleDateString()}","${t.type}","${t.desc}","${t.category}",${t.amount},"${t.note || ''}"`
  );
  const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'kharcha-transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!');
}

/* ── Budget page ── */
const EXPENSE_CATS = ['Food','Transport','Bills','Rent','Shopping','Health','Education','Entertainment','Savings','Other'];

function renderBudget() {
  const fieldsEl = document.getElementById('budget-fields');
  fieldsEl.innerHTML = EXPENSE_CATS.map(cat => `
    <div class="budget-field">
      <label>${CAT_EMOJIS[cat] || ''} ${cat}</label>
      <input type="number" min="0" step="100" placeholder="0"
             id="budget-${cat}"
             value="${budgets[cat] || ''}"
             aria-label="${cat} budget" />
    </div>`).join('');

  renderBudgetStatus();
}

function saveBudgets() {
  EXPENSE_CATS.forEach(cat => {
    const val = parseFloat(document.getElementById('budget-' + cat).value);
    if (val > 0) budgets[cat] = val;
    else delete budgets[cat];
  });
  localStorage.setItem('kharcha_budgets', JSON.stringify(budgets));
  const msg = document.getElementById('budget-saved-msg');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 2000);
  showToast('Budgets saved!');
  renderBudgetStatus();
}

function renderBudgetStatus() {
  const statusEl = document.getElementById('budget-status-list');
  const now = new Date();
  const monthTxns = getMonthTxns(now);
  const cm = catMap(monthTxns);

  const budgetedCats = Object.keys(budgets);
  if (!budgetedCats.length) {
    statusEl.innerHTML = '<p class="empty-msg">Set budgets on the left to see your progress here.</p>';
    return;
  }

  statusEl.innerHTML = budgetedCats.map(cat => {
    const spent  = cm[cat] || 0;
    const limit  = budgets[cat];
    const pct    = Math.min(Math.round((spent / limit) * 100), 100);
    const over   = spent > limit;
    const color  = over ? '#dc2626' : pct >= 80 ? '#d97706' : '#16a34a';
    return `
      <div class="budget-item">
        <div class="budget-item-header">
          <span>${CAT_EMOJIS[cat] || ''} ${cat}</span>
          <span style="color:${color};font-weight:600">${fmt(spent)} / ${fmt(limit)}</span>
        </div>
        <div class="budget-bar-bg">
          <div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div style="font-size:11px;color:var(--ink-4);margin-top:3px;text-align:right">
          ${over ? `Over by Rs ${Math.round(spent-limit).toLocaleString()}` : `Rs ${Math.round(limit-spent).toLocaleString()} remaining`}
        </div>
      </div>`;
  }).join('');
}

/* ── Reports page ── */
function renderReports() {
  const sel = document.getElementById('report-month');
  // Build month options from available transactions + current month
  const months = new Set();
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.add(d.getFullYear() + '-' + String(d.getMonth()).padStart(2,'0'));
  }
  transactions.forEach(t => months.add(t.date.getFullYear() + '-' + String(t.date.getMonth()).padStart(2,'0')));
  const sorted = [...months].sort().reverse();

  if (!sel.options.length || sel.dataset.built !== '1') {
    sel.innerHTML = sorted.map(key => {
      const [y, m] = key.split('-');
      return `<option value="${key}">${MONTHS[+m]} ${y}</option>`;
    }).join('');
    sel.dataset.built = '1';
  }

  const [selY, selM] = sel.value.split('-').map(Number);
  const mt = transactions.filter(t => t.date.getMonth() === selM && t.date.getFullYear() === selY);
  const { inc, exp, bal } = totals(mt);
  const cm = catMap(mt);

  document.getElementById('rpt-income').textContent  = fmt(inc);
  document.getElementById('rpt-expense').textContent = fmt(exp);
  const netEl = document.getElementById('rpt-net');
  netEl.textContent = fmtS(bal);
  netEl.style.color = bal < 0 ? 'var(--red)' : 'var(--green)';

  const topCat = Object.entries(cm).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('rpt-top').textContent = topCat
    ? `${CAT_EMOJIS[topCat[0]] || ''} ${topCat[0]} (${fmt(topCat[1])})`
    : '—';

  renderLineChart(mt, selY, selM);
  renderHbarChart(cm);
}

function renderLineChart(mt, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyExp = Array(daysInMonth).fill(0);
  mt.filter(t => t.type === 'expense').forEach(t => { dailyExp[t.date.getDate() - 1] += t.amount; });

  if (lineChartInst) lineChartInst.destroy();
  lineChartInst = new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels: Array.from({ length: daysInMonth }, (_, i) => i + 1),
      datasets: [{
        label: 'Expenses',
        data: dailyExp.map(v => Math.round(v)),
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220,38,38,.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#dc2626',
        fill: true,
        tension: .35
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' Rs ' + ctx.parsed.y.toLocaleString() } }
      },
      scales: {
        x: { ticks: { color: '#9ca3af', font: { size: 11 }, autoSkip: true, maxTicksLimit: 10 }, grid: { display: false }, border: { display: false } },
        y: { ticks: { color: '#9ca3af', font: { size: 11 }, callback: v => 'Rs ' + v.toLocaleString() }, grid: { color: 'rgba(0,0,0,.05)' }, border: { display: false } }
      }
    }
  });
}

function renderHbarChart(cm) {
  const entries = Object.entries(cm).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const colors  = entries.map((_, i) => CAT_COLORS[i % CAT_COLORS.length]);

  if (hbarChartInst) hbarChartInst.destroy();
  if (!entries.length) return;

  const wrapEl = document.getElementById('hbarChart').parentElement;
  wrapEl.style.height = Math.max(200, entries.length * 40 + 60) + 'px';

  hbarChartInst = new Chart(document.getElementById('hbarChart'), {
    type: 'bar',
    data: {
      labels: entries.map(([k]) => k),
      datasets: [{
        data: entries.map(([, v]) => Math.round(v)),
        backgroundColor: colors,
        borderRadius: 4,
        barPercentage: 0.6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' Rs ' + ctx.parsed.x.toLocaleString() } }
      },
      scales: {
        x: { ticks: { color: '#9ca3af', font: { size: 11 }, callback: v => 'Rs ' + v.toLocaleString() }, grid: { color: 'rgba(0,0,0,.05)' }, border: { display: false } },
        y: { ticks: { color: '#374151', font: { size: 12 } }, grid: { display: false }, border: { display: false } }
      }
    }
  });
}

/* ── Add page quick stats ── */
function renderAddQuickStats() {
  const now = new Date();
  const mt  = getMonthTxns(now);
  const exp = mt.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const today = transactions.filter(t =>
    t.date.toDateString() === now.toDateString()
  ).length;
  document.getElementById('qs-month-exp').textContent = fmt(exp);
  document.getElementById('qs-today').textContent     = today;
}

/* ── Escape HTML ── */
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Init ── */
function init() {
  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('f-date').value = today;

  // Create sidebar overlay for mobile
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.onclick = toggleSidebar;
  document.body.appendChild(overlay);

  // Render initial page
  renderDashboard();
}

document.addEventListener('DOMContentLoaded', init);
