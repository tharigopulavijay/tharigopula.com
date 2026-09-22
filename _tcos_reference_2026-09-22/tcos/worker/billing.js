/* =========================================================================
   Billing.

   Every function takes doctorId first and every statement names it, exactly
   as repo.js requires - these tables are clinical-adjacent and hold what a
   patient was charged, which is nobody else's business.

   Money is integer paise throughout. It becomes rupees once, on the way to
   a screen, and never comes back as a float.
   ========================================================================= */

import { newId, nowIso, badRequest, notFound, forbidden } from '@tharigopula/core/lib';

/* Rounding happens in exactly one place. Half-up, because that is what a
   printed bill does and what the patient counting notes expects. */
const round = n => Math.round(n);
const changedRows = result => Number(result &&
  (result.meta ? result.meta.changes : result.changes) || 0);
const ITEM_KINDS = new Set(['consultation', 'medicine', 'procedure', 'lab', 'other']);

export const billing = {

  /* ------------------------------- invoices ---------------------------- */

  async list(db, doctorId, { status, from, to, patientId, limit = 100 } = {}) {
    const where = ['i.doctor_id = ?'];
    const bind = [doctorId];
    if (status && status !== 'all') { where.push('i.status = ?'); bind.push(status); }
    if (patientId) { where.push('i.patient_id = ?'); bind.push(patientId); }
    if (from) { where.push("COALESCE(i.issued_on, date(i.created_at)) >= ?"); bind.push(from); }
    if (to) { where.push("COALESCE(i.issued_on, date(i.created_at)) <= ?"); bind.push(to); }

    const { results } = await db.prepare(
      `SELECT i.*, p.full_name, p.mobile, dp.local_ref,
              COALESCE((SELECT SUM(amount) FROM payments pay
                         WHERE pay.invoice_id = i.id AND pay.doctor_id = i.doctor_id), 0) AS paid
         FROM invoices i
         JOIN patients p ON p.id = i.patient_id
    LEFT JOIN doctor_patients dp
           ON dp.patient_id = i.patient_id AND dp.doctor_id = i.doctor_id
        WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(i.issued_on, date(i.created_at)) DESC, i.created_at DESC
        LIMIT ?`
    ).bind(...bind, Math.min(Number(limit) || 100, 500)).all();
    return results || [];
  },

  async withItems(db, doctorId, id) {
    const invoice = await db.prepare(
      `SELECT i.*, p.full_name, p.mobile, p.sex, p.date_of_birth, dp.local_ref
         FROM invoices i
         JOIN patients p ON p.id = i.patient_id
    LEFT JOIN doctor_patients dp
           ON dp.patient_id = i.patient_id AND dp.doctor_id = i.doctor_id
        WHERE i.id = ? AND i.doctor_id = ?`
    ).bind(id, doctorId).first();
    if (!invoice) throw notFound('That bill does not exist.');

    const { results: items } = await db.prepare(
      'SELECT * FROM invoice_items WHERE invoice_id = ? AND doctor_id = ? ORDER BY sort_order'
    ).bind(id, doctorId).all();

    const { results: payments } = await db.prepare(
      `SELECT * FROM payments WHERE invoice_id = ? AND doctor_id = ?
        ORDER BY received_on, created_at`
    ).bind(id, doctorId).all();

    invoice.items = items || [];
    invoice.payments = payments || [];
    invoice.paid = invoice.payments.reduce((n, p) => n + p.amount, 0);
    invoice.balance = invoice.total - invoice.paid;
    return invoice;
  },

  async createDraft(db, doctorId, { patientId, visitId }) {
    const id = newId('inv');
    await db.prepare(
      `INSERT INTO invoices (id, doctor_id, patient_id, visit_id, status)
       VALUES (?,?,?,?, 'draft')`
    ).bind(id, doctorId, patientId, visitId || null).run();
    return this.withItems(db, doctorId, id);
  },

  /* Replaces every line and recomputes the totals. A draft is the only thing
     this may be called on - see requireDraft. */
  async replaceItems(db, doctorId, invoiceId, items, { discount = 0, taxRate = 0, note } = {}) {
    await this.requireDraft(db, doctorId, invoiceId);
    let subtotal = 0;
    let order = 0;
    const cleanItems = [];
    for (const item of items || []) {
      const description = String(item.description || '').trim();
      if (!description) continue;
      const quantity = item.quantity == null ? 1 : Number(item.quantity);
      const unitPrice = round(Number(item.unitPrice));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw badRequest('Every bill line needs a quantity greater than zero.');
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw badRequest('A bill line cannot have a negative or unreadable price.');
      }
      const amount = round(quantity * unitPrice);
      subtotal += amount;
      cleanItems.push({
        id: newId('ivi'), kind: ITEM_KINDS.has(item.kind) ? item.kind : 'other',
        description, quantity, unitPrice, amount, order: order++
      });
    }

    const cleanDiscount = Math.max(0, Math.min(round(Number(discount) || 0), subtotal));
    const taxable = subtotal - cleanDiscount;
    const rate = Number(taxRate) || 0;
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw badRequest('Tax rate must be between 0 and 100.');
    }
    const taxAmount = round(taxable * rate / 100);

    const statements = [db.prepare(
      `DELETE FROM invoice_items
        WHERE invoice_id = ? AND doctor_id = ?
          AND EXISTS (SELECT 1 FROM invoices
                       WHERE id = ? AND doctor_id = ? AND status = 'draft')`
    ).bind(invoiceId, doctorId, invoiceId, doctorId)];
    for (const item of cleanItems) {
      statements.push(db.prepare(
        `INSERT INTO invoice_items (id, invoice_id, doctor_id, kind, description,
           quantity, unit_price, amount, sort_order)
         SELECT ?,?,?,?,?,?,?,?,?
          WHERE EXISTS (SELECT 1 FROM invoices
                         WHERE id = ? AND doctor_id = ? AND status = 'draft')`
      ).bind(item.id, invoiceId, doctorId, item.kind, item.description,
        item.quantity, item.unitPrice, item.amount, item.order,
        invoiceId, doctorId));
    }
    statements.push(db.prepare(
      `UPDATE invoices SET subtotal = ?, discount = ?, tax_rate = ?, tax_amount = ?,
         total = ?, note = ? WHERE id = ? AND doctor_id = ? AND status = 'draft'`
    ).bind(subtotal, cleanDiscount, rate, taxAmount, taxable + taxAmount,
      note == null ? null : String(note), invoiceId, doctorId));

    /* Replacing lines and recomputing the total is one transaction. A
       failed line or a concurrent Issue click leaves the previous draft
       untouched rather than a half-written bill. */
    const results = await db.batch(statements);
    if (changedRows(results[results.length - 1]) !== 1) {
      throw forbidden('This bill was issued while it was being edited. Refresh it before continuing.');
    }

    return this.withItems(db, doctorId, invoiceId);
  },

  async requireDraft(db, doctorId, invoiceId) {
    const row = await db.prepare(
      'SELECT status FROM invoices WHERE id = ? AND doctor_id = ?'
    ).bind(invoiceId, doctorId).first();
    if (!row) throw notFound('That bill does not exist.');
    if (row.status !== 'draft') {
      throw forbidden('This bill has already been given to the patient. ' +
        'Cancel it and raise a new one instead of changing it.');
    }
    return row;
  },

  /* Numbering is gap-free and per year, the same scheme as prescriptions. A
     missing number in a bill book is the first thing an auditor asks about. */
  async nextNumber(db, doctorId, prefix) {
    const year = new Date().getFullYear();
    const row = await db.prepare(
      `INSERT INTO invoice_sequences (doctor_id, year, next_no) VALUES (?, ?, 1)
       ON CONFLICT(doctor_id, year) DO UPDATE SET next_no = next_no + 1
       RETURNING next_no`
    ).bind(doctorId, year).first();
    const n = row ? row.next_no : 1;
    return (prefix || 'TCOS') + '/INV/' + year + '/' + String(n).padStart(4, '0');
  },

  async issue(db, doctorId, invoiceId, prefix, actor) {
    const invoice = await this.withItems(db, doctorId, invoiceId);
    if (invoice.status !== 'draft') throw forbidden('This bill has already been issued.');
    if (!invoice.items.length) throw badRequest('Add at least one line before issuing.');
    const year = new Date().getFullYear();
    const issuedOn = new Date().toISOString().slice(0, 10);
    const safePrefix = String(prefix || 'TCOS').trim() || 'TCOS';

    /* 'issuing' exists only inside this transaction. It claims the draft
       before the sequence advances, so two Issue clicks cannot consume two
       numbers and cannot return the wrong number to either caller. */
    const statements = [db.prepare(
      `UPDATE invoices SET status = 'issuing'
        WHERE id = ? AND doctor_id = ? AND status = 'draft'
          AND EXISTS (SELECT 1 FROM invoice_items
                       WHERE invoice_id = ? AND doctor_id = ?)`
    ).bind(invoiceId, doctorId, invoiceId, doctorId), db.prepare(
      `INSERT INTO invoice_sequences (doctor_id, year, next_no)
       SELECT ?, ?, 1
        WHERE EXISTS (SELECT 1 FROM invoices
                       WHERE id = ? AND doctor_id = ? AND status = 'issuing')
       ON CONFLICT(doctor_id, year) DO UPDATE SET next_no = next_no + 1`
    ).bind(doctorId, year, invoiceId, doctorId), db.prepare(
      `UPDATE invoices
          SET status = 'issued',
              invoice_no = ? || '/INV/' || ? || '/' || printf('%04d',
                (SELECT next_no FROM invoice_sequences WHERE doctor_id = ? AND year = ?)),
              issued_on = ?
        WHERE id = ? AND doctor_id = ? AND status = 'issuing'`
    ).bind(safePrefix, year, doctorId, year, issuedOn, invoiceId, doctorId), db.prepare(
      `INSERT INTO audit_events
         (id, doctor_id, actor, action, target_type, target_id, detail)
       SELECT ?, ?, ?, 'invoice_issued', 'invoice', i.id, i.invoice_no
         FROM invoices i
        WHERE i.id = ? AND i.doctor_id = ? AND i.status = 'issued'`
    ).bind(newId('aud'), doctorId, actor || 'doctor:' + doctorId, invoiceId, doctorId)];

    const results = await db.batch(statements);
    if (changedRows(results[0]) !== 1) {
      throw forbidden('This bill has already been issued. Refresh the bill list.');
    }
    return this.withItems(db, doctorId, invoiceId);
  },

  /* Cancelling keeps the row and the number. Deleting it would leave a hole
     in the sequence, which looks exactly like something being hidden. */
  async cancel(db, doctorId, invoiceId, reason, actor) {
    if (!reason || !String(reason).trim()) {
      throw badRequest('Say why this bill is being cancelled. It stays on the record.');
    }
    const invoice = await this.withItems(db, doctorId, invoiceId);
    if (invoice.status === 'cancelled') throw badRequest('Already cancelled.');
    if (invoice.paid > 0) {
      throw badRequest('Money has already been received against this bill. ' +
        'Refund it first, or leave the bill and record the refund separately.');
    }
    const at = nowIso();
    const cleanReason = String(reason).trim();
    const results = await db.batch([db.prepare(
      `UPDATE invoices SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?
        WHERE id = ? AND doctor_id = ? AND status != 'cancelled'
          AND NOT EXISTS (SELECT 1 FROM payments
                           WHERE invoice_id = ? AND doctor_id = ?)`
    ).bind(at, cleanReason, invoiceId, doctorId, invoiceId, doctorId), db.prepare(
      `INSERT INTO audit_events
         (id, doctor_id, actor, action, target_type, target_id, detail)
       SELECT ?, ?, ?, 'invoice_cancelled', 'invoice', i.id,
              COALESCE(i.invoice_no || ' - ', '') || i.cancel_reason
         FROM invoices i
        WHERE i.id = ? AND i.doctor_id = ? AND i.status = 'cancelled'
          AND i.cancelled_at = ?`
    ).bind(newId('aud'), doctorId, actor || 'doctor:' + doctorId,
      invoiceId, doctorId, at)]);
    if (changedRows(results[0]) !== 1) {
      const current = await this.withItems(db, doctorId, invoiceId);
      if (current.paid > 0) {
        throw badRequest('Money has already been received against this bill. ' +
          'Refund it first, or leave the bill and record the refund separately.');
      }
      throw badRequest('Already cancelled.');
    }
    return this.withItems(db, doctorId, invoiceId);
  },

  /* ------------------------------- payments ---------------------------- */

  async addPayment(db, doctorId, invoiceId, {
    amount, method, reference, receivedOn, receivedBy, idempotencyKey, actor
  }) {
    const key = String(idempotencyKey || '').trim();
    if (key.length < 8 || key.length > 100) {
      throw badRequest('This payment request has expired. Reopen the payment box and try again.');
    }
    const repeated = await db.prepare(
      `SELECT id FROM payments
        WHERE doctor_id = ? AND invoice_id = ? AND idempotency_key = ?`
    ).bind(doctorId, invoiceId, key).first();
    if (repeated) return this.withItems(db, doctorId, invoiceId);

    const invoice = await this.withItems(db, doctorId, invoiceId);
    if (invoice.status === 'draft') {
      throw badRequest('Issue the bill before recording money against it.');
    }
    if (invoice.status === 'cancelled') throw badRequest('This bill was cancelled.');

    const paise = round(Number(amount) || 0);
    if (paise <= 0) throw badRequest('Enter an amount.');
    if (paise > invoice.balance) {
      throw badRequest('That is more than the ' + (invoice.balance / 100).toFixed(2) +
        ' still outstanding.');
    }
    if (!['cash', 'upi', 'card', 'bank', 'other'].includes(method)) {
      throw badRequest('Choose how it was paid.');
    }

    const paymentId = newId('pay');
    const on = receivedOn || new Date().toISOString().slice(0, 10);
    let results;
    try {
      results = await db.batch([db.prepare(
      `INSERT INTO payments (id, invoice_id, doctor_id, amount, method, reference,
         received_on, received_by, idempotency_key)
       SELECT ?,?,?,?,?,?,?,?,?
        FROM invoices i
       WHERE i.id = ? AND i.doctor_id = ? AND i.status = 'issued'
         AND ? <= i.total - COALESCE((SELECT SUM(p.amount) FROM payments p
                                      WHERE p.invoice_id = i.id
                                        AND p.doctor_id = i.doctor_id), 0)`
      ).bind(paymentId, invoiceId, doctorId, paise, method,
        reference ? String(reference).trim() : null,
        on, receivedBy || null, key, invoiceId, doctorId, paise), db.prepare(
        `INSERT INTO audit_events
           (id, doctor_id, actor, action, target_type, target_id, detail)
         SELECT ?, ?, ?, 'payment_received', 'invoice', ?, ?
          WHERE EXISTS (SELECT 1 FROM payments
                         WHERE id = ? AND doctor_id = ? AND invoice_id = ?)`
      ).bind(newId('aud'), doctorId, actor || 'doctor:' + doctorId, invoiceId,
        (paise / 100).toFixed(2) + ' by ' + method,
        paymentId, doctorId, invoiceId)]);
    } catch (error) {
      /* A network retry may race its first request. The unique key decides
         which one won; both callers receive the same resulting invoice. */
      if (!String(error.message || '').includes('UNIQUE')) throw error;
      const won = await db.prepare(
        `SELECT id FROM payments
          WHERE doctor_id = ? AND invoice_id = ? AND idempotency_key = ?`
      ).bind(doctorId, invoiceId, key).first();
      if (won) return this.withItems(db, doctorId, invoiceId);
      throw error;
    }

    if (changedRows(results[0]) !== 1) {
      const current = await this.withItems(db, doctorId, invoiceId);
      if (current.status === 'cancelled') throw badRequest('This bill was cancelled.');
      if (current.status !== 'issued') {
        throw badRequest('Issue the bill before recording money against it.');
      }
      throw badRequest('That is more than the ' + (current.balance / 100).toFixed(2) +
        ' still outstanding.');
    }

    return this.withItems(db, doctorId, invoiceId);
  },

  /* ---------------------------- what she charges ----------------------- */

  async fees(db, doctorId) {
    const { results } = await db.prepare(
      'SELECT * FROM fee_items WHERE doctor_id = ? AND active = 1 ORDER BY kind, description'
    ).bind(doctorId).all();
    return results || [];
  },

  async addFee(db, doctorId, { kind, description, unitPrice }) {
    if (!description || !String(description).trim()) throw badRequest('Name the charge.');
    const id = newId('fee');
    await db.prepare(
      'INSERT INTO fee_items (id, doctor_id, kind, description, unit_price) VALUES (?,?,?,?,?)'
    ).bind(id, doctorId, kind || 'consultation', String(description).trim(),
      round(Number(unitPrice) || 0)).run();
    return db.prepare('SELECT * FROM fee_items WHERE id = ? AND doctor_id = ?')
      .bind(id, doctorId).first();
  },

  async removeFee(db, doctorId, id) {
    await db.prepare('UPDATE fee_items SET active = 0 WHERE id = ? AND doctor_id = ?')
      .bind(id, doctorId).run();
  },

  /* ------------------------------- the money --------------------------- */

  /* One query for the whole billing summary. Every figure is derived from
     invoices and payments as they stand - nothing is cached, so nothing can
     drift away from the rows it came from. */
  async summary(db, doctorId, from, to) {
    const money = await db.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN i.status = 'issued' THEN i.total END), 0) AS billed,
         COUNT(CASE WHEN i.status = 'issued' THEN 1 END)  AS issued_count,
         COUNT(CASE WHEN i.status = 'draft'  THEN 1 END)  AS draft_count,
         COUNT(CASE WHEN i.status = 'cancelled' THEN 1 END) AS cancelled_count
       FROM invoices i
      WHERE i.doctor_id = ?
        AND COALESCE(i.issued_on, date(i.created_at)) BETWEEN ? AND ?`
    ).bind(doctorId, from, to).first();

    const collected = await db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS collected, COUNT(*) AS payment_count
         FROM payments WHERE doctor_id = ? AND received_on BETWEEN ? AND ?`
    ).bind(doctorId, from, to).first();

    /* Outstanding is deliberately NOT limited to the date range: money owed
       from last month is still owed today, and a figure that quietly forgets
       it would be worse than no figure. */
    const owed = await db.prepare(
      `SELECT COALESCE(SUM(i.total - COALESCE(
                (SELECT SUM(p.amount) FROM payments p
                  WHERE p.invoice_id = i.id AND p.doctor_id = i.doctor_id), 0)), 0) AS outstanding,
              COUNT(*) AS unpaid_count
         FROM invoices i
        WHERE i.doctor_id = ? AND i.status = 'issued'
          AND i.total > COALESCE((SELECT SUM(p.amount) FROM payments p
                                   WHERE p.invoice_id = i.id AND p.doctor_id = i.doctor_id), 0)`
    ).bind(doctorId).first();

    const { results: byMethod } = await db.prepare(
      `SELECT method, SUM(amount) AS amount, COUNT(*) AS n
         FROM payments WHERE doctor_id = ? AND received_on BETWEEN ? AND ?
     GROUP BY method ORDER BY amount DESC`
    ).bind(doctorId, from, to).all();

    return {
      from, to,
      billed: money.billed, issuedCount: money.issued_count,
      draftCount: money.draft_count, cancelledCount: money.cancelled_count,
      collected: collected.collected, paymentCount: collected.payment_count,
      outstanding: owed.outstanding, unpaidCount: owed.unpaid_count,
      byMethod: byMethod || []
    };
  },

  /* Money taken per day, for the strip on the billing screen. */
  async dailyCollected(db, doctorId, from, to) {
    const { results } = await db.prepare(
      `SELECT received_on AS day, SUM(amount) AS amount
         FROM payments WHERE doctor_id = ? AND received_on BETWEEN ? AND ?
     GROUP BY received_on ORDER BY received_on`
    ).bind(doctorId, from, to).all();
    return results || [];
  }
};
