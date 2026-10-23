const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADDRESS = process.env.ADDRESS || '0.0.0.0';
const db = new DatabaseSync(path.join(__dirname, 'expenses.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL,          -- YYYY-MM-DD
    amount_cents INTEGER NOT NULL,          -- stored as cents, avoids float errors
    place        TEXT    NOT NULL,
    person       TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
`);

// ---- business logic -------------------------------------------------------
function parseAmountToCents(input) {
  const s = String(input ?? '').trim().replace(/€/g, '').replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return cents > 0 ? cents : null;
}

function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function validate(body) {
  const date = String(body.date ?? '').trim();
  const place = String(body.place ?? '').trim();
  const person = String(body.person ?? '').trim();
  const cents = parseAmountToCents(body.amount);
  const errors = [];
  if (!isValidDate(date)) errors.push('Date must be a real date in the format YYYY-MM-DD.');
  if (cents === null) errors.push('Amount must be a positive number in euros, e.g. 12,50.');
  if (!place) errors.push('Please enter where the money was spent.');
  if (!person) errors.push('Please enter who spent the money.');
  return { errors, value: { date, cents, place: place.slice(0, 100), person: person.slice(0, 50) } };
}

const toEuro = (row) => ({ id: row.id, date: row.date, place: row.place, person: row.person, amount: row.amount_cents / 100 });

// ---- API ------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/expenses', (req, res) => {
  const rows = db.prepare('SELECT * FROM expenses ORDER BY date DESC, id DESC').all();
  res.json(rows.map(toEuro));
});

app.post('/api/expenses', (req, res) => {
  const { errors, value } = validate(req.body || {});
  if (errors.length) return res.status(400).json({ errors });
  const info = db
    .prepare('INSERT INTO expenses (date, amount_cents, place, person) VALUES (?, ?, ?, ?)')
    .run(value.date, value.cents, value.place, value.person);
  res.status(201).json(toEuro(db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid)));
});

app.delete('/api/expenses/:id', (req, res) => {
  const info = db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.status(info.changes ? 204 : 404).end();
});

app.get('/api/summary/monthly', (req, res) => {
  const rows = db.prepare(`
    SELECT substr(date, 1, 7) AS month, COUNT(*) AS count, SUM(amount_cents) AS total
    FROM expenses GROUP BY month ORDER BY month DESC
  `).all();
  res.json(rows.map((r) => ({ month: r.month, count: r.count, total: r.total / 100 })));
});

app.get('/api/summary/people', (req, res) => {
  const rows = db.prepare(`
    SELECT person, COUNT(*) AS count, SUM(amount_cents) AS total
    FROM expenses GROUP BY person COLLATE NOCASE ORDER BY total DESC
  `).all();
  const max = rows.length ? rows[0].total : 0;
  const sum = rows.reduce((a, r) => a + r.total, 0);
  res.json(rows.map((r) => ({
    person: r.person,
    count: r.count,
    total: r.total / 100,
    totalFromAll: sum / 100,
    shareOfMax: max ? r.total / max : 0,   // bar length (top spender = 100%)
    shareOfTotal: sum ? r.total / sum : 0  // percentage of all spending
  })));
});

app.listen(PORT, ADDRESS, () => console.log(`Expense tracker running on http://${ADDRESS}:${PORT}`));
