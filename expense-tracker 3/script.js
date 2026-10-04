(() => {
  'use strict';

  const STORAGE_KEY = 'expense-tracker:transactions:v1';
  const MAX_AMOUNT = 1000000000;
  const CATEGORIES = {
    expense: ['Food', 'Rent', 'Transport', 'Utilities', 'Shopping', 'Health', 'Entertainment', 'Education', 'Other'],
    income: ['Salary', 'Freelance', 'Investment', 'Gift', 'Other']
  };
  const ALL_CATEGORIES = [...new Set([...CATEGORIES.expense, ...CATEGORIES.income])].sort();

  const $ = (id) => document.getElementById(id);
  const form = $('txForm');
  const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
  const money = (n) => fmt.format(n);

  let transactions = load();
  let editingId = null;
  let pendingDeleteId = null;
  let toastTimer;

  /* ---------- Storage ---------- */
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!Array.isArray(data)) return [];
      return data.filter((t) => t && t.id && (t.type === 'income' || t.type === 'expense') && Number.isFinite(t.amount));
    } catch (e) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      return true;
    } catch (e) {
      toast('Could not save to browser storage. Changes will be lost on refresh.');
      return false;
    }
  }

  /* ---------- Helpers ---------- */
  const todayISO = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };
  const cents = (n) => Math.round(n * 100);
  const sum = (list) => list.reduce((s, t) => s + cents(t.amount), 0) / 100;
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const formatDate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------- Form ---------- */
  const currentType = () => form.elements.type.value;

  function fillCategories(selected) {
    const sel = $('category');
    sel.innerHTML = '<option value="">Select a category</option>' +
      CATEGORIES[currentType()].map((c) => `<option value="${c}">${c}</option>`).join('');
    sel.value = selected || '';
  }

  function setError(name, msg) {
    $(name + 'Err').textContent = msg || '';
    const field = $(name).closest('.field');
    field.classList.toggle('invalid', !!msg);
    $(name).setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function validate() {
    const errors = {};
    const amountRaw = $('amount').value.trim();
    const amount = Number(amountRaw);
    if (!amountRaw) errors.amount = 'Enter an amount.';
    else if (!Number.isFinite(amount) || amount <= 0) errors.amount = 'Amount must be greater than 0.';
    else if (amount > MAX_AMOUNT) errors.amount = 'Amount is too large.';
    else if (Math.round(amount * 100) !== amount * 100 && Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) errors.amount = 'Use at most 2 decimal places.';

    if (!$('category').value) errors.category = 'Choose a category.';

    const date = $('date').value;
    if (!date) errors.date = 'Pick a date.';
    else if (Number.isNaN(Date.parse(date)) || date < '1970-01-01' || date > '2100-12-31') errors.date = 'Enter a valid date.';

    const desc = $('description').value.trim();
    if (!desc) errors.description = 'Add a short description.';
    else if (desc.length > 80) errors.description = 'Keep it under 80 characters.';

    ['amount', 'category', 'date', 'description'].forEach((n) => setError(n, errors[n]));
    const first = Object.keys(errors)[0];
    if (first) $(first).focus();
    return { ok: !first, amount, desc };
  }

  function resetForm() {
    editingId = null;
    form.reset();
    ['amount', 'category', 'date', 'description'].forEach((n) => setError(n, ''));
    fillCategories('');
    $('date').value = todayISO();
    $('formTitle').textContent = 'Add transaction';
    $('submitBtn').textContent = 'Add transaction';
    $('cancelBtn').hidden = true;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { ok, amount, desc } = validate();
    if (!ok) return;
    const data = {
      type: currentType(),
      amount: Math.round(amount * 100) / 100,
      category: $('category').value,
      date: $('date').value,
      description: desc
    };
    if (editingId) {
      transactions = transactions.map((t) => (t.id === editingId ? { ...t, ...data } : t));
      toast('Transaction updated.');
    } else {
      transactions.push({ id: uid(), createdAt: Date.now(), ...data });
      toast('Transaction added.');
    }
    save();
    resetForm();
    render();
  });

  form.addEventListener('change', (e) => {
    if (e.target.name === 'type') fillCategories('');
  });
  ['amount', 'category', 'date', 'description'].forEach((n) =>
    $(n).addEventListener('input', () => $(n + 'Err').textContent && setError(n, '')));

  $('cancelBtn').addEventListener('click', resetForm);

  function startEdit(id) {
    const t = transactions.find((x) => x.id === id);
    if (!t) return;
    editingId = id;
    form.elements.type.value = t.type;
    fillCategories(t.category);
    $('amount').value = t.amount;
    $('date').value = t.date;
    $('description').value = t.description;
    $('formTitle').textContent = 'Edit transaction';
    $('submitBtn').textContent = 'Save changes';
    $('cancelBtn').hidden = false;
    render();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('amount').focus({ preventScroll: true });
  }

  /* ---------- Delete ---------- */
  const dlg = $('confirmDlg');
  function askDelete(id) {
    const t = transactions.find((x) => x.id === id);
    if (!t) return;
    pendingDeleteId = id;
    $('confirmText').textContent = `Delete "${t.description}" (${money(t.amount)})?`;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else if (confirm($('confirmText').textContent)) doDelete();
  }
  function doDelete() {
    transactions = transactions.filter((t) => t.id !== pendingDeleteId);
    if (editingId === pendingDeleteId) resetForm();
    pendingDeleteId = null;
    save();
    render();
    toast('Transaction deleted.');
  }
  dlg.addEventListener('close', () => {
    if (dlg.returnValue === 'ok') doDelete();
    dlg.returnValue = '';
  });

  /* ---------- Rendering ---------- */
  function renderTotals() {
    const income = sum(transactions.filter((t) => t.type === 'income'));
    const expense = sum(transactions.filter((t) => t.type === 'expense'));
    const balance = Math.round((income - expense) * 100) / 100;
    $('totalIncome').textContent = money(income);
    $('totalExpense').textContent = money(expense);
    $('balance').textContent = money(balance);
    $('balance').classList.toggle('neg', balance < 0);
  }

  function filtered() {
    const type = $('filterType').value;
    const cat = $('filterCategory').value;
    return transactions
      .filter((t) => (type === 'all' || t.type === type) && (cat === 'all' || t.category === cat))
      .sort((a, b) => (b.date.localeCompare(a.date)) || ((b.createdAt || 0) - (a.createdAt || 0)));
  }

  function renderList() {
    const list = filtered();
    $('count').textContent = transactions.length
      ? `Showing ${list.length} of ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`
      : '';
    if (!list.length) {
      $('list').innerHTML = `<li class="empty">${transactions.length
        ? 'No transactions match these filters.'
        : 'No transactions yet. Add your first income or expense to get started.'}</li>`;
      return;
    }
    $('list').innerHTML = list.map((t) => `
      <li class="tx${t.id === editingId ? ' editing' : ''}">
        <div class="tx-main">
          <div class="tx-desc">${esc(t.description)}</div>
          <div class="tx-meta"><span class="tag">${esc(t.category)}</span>${formatDate(t.date)}</div>
        </div>
        <div class="tx-amt ${t.type}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</div>
        <div class="tx-btns">
          <button class="icon" data-act="edit" data-id="${t.id}" aria-label="Edit ${esc(t.description)}">Edit</button>
          <button class="icon del" data-act="del" data-id="${t.id}" aria-label="Delete ${esc(t.description)}">Delete</button>
        </div>
      </li>`).join('');
  }

  function renderMonth() {
    const month = $('month').value;
    const inMonth = month ? transactions.filter((t) => t.date.startsWith(month)) : [];
    const income = sum(inMonth.filter((t) => t.type === 'income'));
    const expenses = inMonth.filter((t) => t.type === 'expense');
    const expense = sum(expenses);
    const net = Math.round((income - expense) * 100) / 100;
    $('mIncome').textContent = money(income);
    $('mExpense').textContent = money(expense);
    $('mNet').textContent = money(net);
    $('mNet').className = net < 0 ? 'neg' : net > 0 ? 'pos' : '';

    const byCat = {};
    expenses.forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + cents(t.amount); });
    const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const total = rows.reduce((s, r) => s + r[1], 0);
    $('chart').innerHTML = rows.length
      ? rows.map(([c, v]) => {
          const pct = (v / total) * 100;
          return `<div class="bar-row"><span>${esc(c)}</span>
            <div class="bar-track" role="img" aria-label="${esc(c)} ${pct.toFixed(0)} percent"><div class="bar-fill" style="width:${pct}%"></div></div>
            <span class="bar-val">${money(v / 100)} <small>${pct.toFixed(0)}%</small></span></div>`;
        }).join('')
      : '<p class="empty">No expenses recorded for this month.</p>';
  }

  function render() {
    renderTotals();
    renderList();
    renderMonth();
  }

  /* ---------- Events ---------- */
  $('list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'edit') startEdit(btn.dataset.id);
    else askDelete(btn.dataset.id);
  });

  $('filterType').addEventListener('change', renderList);
  $('filterCategory').addEventListener('change', renderList);
  $('clearFilters').addEventListener('click', () => {
    $('filterType').value = 'all';
    $('filterCategory').value = 'all';
    renderList();
  });
  $('month').addEventListener('change', renderMonth);

  /* ---------- Init ---------- */
  $('filterCategory').innerHTML = '<option value="all">All</option>' +
    ALL_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');
  $('month').value = todayISO().slice(0, 7);
  resetForm();
  render();
})();
