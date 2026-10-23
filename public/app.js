const $ = (s) => document.querySelector(s);
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const view = $('#view');
const errorBox = $('#error');
let current = 'all';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const monthName = (ym) => new Date(ym + '-01T00:00:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
const api = (url, opts) => fetch(url, opts);

async function render() {
  if (current === 'all') {
    const rows = await (await api('/api/expenses')).json();
    if (!rows.length) return (view.innerHTML = '<p class="empty">Noch keine Einträge.</p>');
    view.innerHTML = `<table>
      <thead><tr><th>Datum</th><th>Wo</th><th>Wer</th><th class="num">Betrag</th><th></th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td>${esc(r.date)}</td>
        <td class="where">${esc(r.place)}</td>
        <td>${esc(r.person)}</td>
        <td class="num">${eur.format(r.amount)}</td>
        <td class="del"><button data-del="${r.id}" aria-label="Eintrag löschen">✕</button></td>
      </tr>`).join('')}</tbody></table>`;
  } else if (current === 'monthly') {
    const rows = await (await api('/api/summary/monthly')).json();
    if (!rows.length) return (view.innerHTML = '<p class="empty">Noch keine Einträge</p>');
    view.innerHTML = `<table>
      <thead><tr><th>Monat</th><th class="num">Betrag</th><th class="num">Total</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${monthName(r.month)}</td><td class="num">${r.count}</td><td class="num">${eur.format(r.total)}</td></tr>`).join('')}</tbody></table>`;
  } else {
    const rows = await (await api('/api/summary/people')).json();
    if (!rows.length) return (view.innerHTML = '<p class="empty">Noch keine Einträge</p>');
    view.innerHTML = rows.map((r) => {
      const balance = r.total - (r.totalFromAll - r.total);
      const cls = balance > 0 ? 'positive' : balance < 0 ? 'negative' : '';
      const sign = balance > 0 ? '+' : '';

      return `<div class="person">
          <div class="row">
            <strong>${esc(r.person)}</strong>
            <span>${eur.format(r.total)} (<span class="${cls}">${sign}${eur.format(balance)}</span>)</span>
          </div>
          <div class="bar"><span style="width:${(r.shareOfMax * 100).toFixed(1)}%"></span></div>
          <div class="meta">${(r.shareOfTotal * 100).toFixed(0)}% von allen Ausgaben · ${r.count} Ausgabe${r.count === 1 ? '' : 'n'}</div>
        </div>`;
    }).join('');
  }
}

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = Object.fromEntries(new FormData(form));
  const res = await api('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const { errors } = await res.json();
    errorBox.textContent = errors.join(' ');
    errorBox.hidden = false;
    return;
  }
  errorBox.hidden = true;
  const keep = { date: body.date, person: body.person };
  form.reset();
  form.date.value = keep.date;      // handy when entering several receipts in a row
  form.person.value = keep.person;
  form.amount.focus();
  render();
});

document.querySelector('nav').addEventListener('click', (e) => {
  const v = e.target.dataset.view;
  if (!v) return;
  current = v;
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b === e.target));
  render();
});

view.addEventListener('click', async (e) => {
  const id = e.target.dataset.del;
  if (id && confirm('Delete this expense?')) {
    await api('/api/expenses/' + id, { method: 'DELETE' });
    render();
  }
});

$('#form').date.value = new Date().toISOString().slice(0, 10);
render();
