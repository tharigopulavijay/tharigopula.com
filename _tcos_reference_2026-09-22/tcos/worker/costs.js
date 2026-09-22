/* =========================================================================
   What the business is actually making.

   Revenue per clinic minus what that clinic costs to run, so the answer to
   "am I making money on this customer" is a number rather than a feeling.

   Two things this is built to make obvious, because both are counter-
   intuitive and both change pricing decisions:

     1. Storage is a rounding error. A clinic uploading ten lab reports a
        day costs single-digit rupees a month to store. Pricing a plan by
        gigabytes charges the customer for the one thing that is nearly
        free, and makes them nervous about using the feature.

     2. Messages are the real variable cost, and they scale with patients
        rather than with clinics. The moment WhatsApp is switched on it
        will be larger than storage, database and compute combined.

   Fixed platform costs are spread across active clinics rather than
   ignored: at three customers the $5 Workers bill is ₹147 each and matters;
   at three hundred it disappears. A margin view that hides it lies most
   exactly when the business is smallest.
   ========================================================================= */

import { badRequest, newId, nowIso } from '@tharigopula/core/lib';

/* usage_events stores a quantity in whatever unit the event counts. This
   turns that into money, given the rate row's unit. */
function costOf(quantity, rate) {
  if (!rate) return 0;
  const n = Number(quantity) || 0;
  switch (rate.unit) {
    case 'per_1000': return Math.round((n / 1000) * rate.paise_per_unit);
    case 'gb_month': return Math.round(n * rate.paise_per_unit);
    case 'month': return rate.paise_per_unit;
    case 'each':
    default: return Math.round(n * rate.paise_per_unit);
  }
}

export const rates = {
  async list(db) {
    const { results } = await db.prepare(
      'SELECT * FROM cost_rates ORDER BY category, label').all();
    return results || [];
  },

  async update(db, id, paisePerUnit) {
    const paise = Number.parseInt(paisePerUnit, 10);
    if (!Number.isFinite(paise) || paise < 0) throw badRequest('Enter the rate in paise.');
    await db.prepare(
      'UPDATE cost_rates SET paise_per_unit = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(paise, id).run();
    return db.prepare('SELECT * FROM cost_rates WHERE id = ?').bind(id).first();
  }
};

const BUSINESS_CATEGORIES = [
  'people', 'software', 'infrastructure', 'communications',
  'marketing', 'professional', 'other'
];

export function monthlyBusinessAmount(row, period) {
  if (row.cadence === 'one_time' && String(row.starts_on).slice(0, 7) !== period) return 0;
  const base = row.cadence === 'yearly'
    ? Math.round(row.amount_paise / 12) : row.amount_paise;
  return Math.round(base * row.allocation_percent / 100);
}

export const businessCosts = {
  async list(db) {
    const { results } = await db.prepare(
      `SELECT bc.*, d.clinic_name
         FROM business_costs bc
    LEFT JOIN doctors d ON d.id = bc.doctor_id
        WHERE bc.active = 1 ORDER BY bc.category, bc.label`
    ).all();
    return results || [];
  },

  async create(db, actor, input) {
    const label = String(input.label || '').trim().slice(0, 140);
    const category = BUSINESS_CATEGORIES.includes(input.category) ? input.category : null;
    const scope = ['shared', 'tcos', 'clinic'].includes(input.scope) ? input.scope : null;
    const cadence = ['monthly', 'yearly', 'one_time'].includes(input.cadence)
      ? input.cadence : null;
    const cashType = ['cash', 'imputed'].includes(input.cashType) ? input.cashType : null;
    const amount = Number.parseInt(input.amountPaise, 10);
    const allocation = Number.parseInt(input.allocationPercent, 10);
    const startsOn = /^\d{4}-\d{2}-\d{2}$/.test(String(input.startsOn || ''))
      ? input.startsOn : null;
    const endsOn = input.endsOn && /^\d{4}-\d{2}-\d{2}$/.test(String(input.endsOn))
      ? input.endsOn : null;
    const doctorId = scope === 'clinic' ? String(input.doctorId || '') : null;
    if (!label || !category || !scope || !cadence || !cashType ||
        !Number.isFinite(amount) || amount < 0 || !startsOn) {
      throw badRequest('Complete the cost name, category, scope, amount, cadence and start date.');
    }
    if (!Number.isFinite(allocation) || allocation < 0 || allocation > 100) {
      throw badRequest('Allocation must be from 0 to 100 percent.');
    }
    if (scope === 'clinic' && !doctorId) throw badRequest('Choose the clinic for this direct cost.');
    if (endsOn && endsOn < startsOn) throw badRequest('The end date cannot be before the start date.');
    const id = newId('cost');
    await db.prepare(
      `INSERT INTO business_costs
         (id, label, category, vendor, scope, doctor_id, amount_paise,
          cadence, cash_type, allocation_percent, starts_on, ends_on,
          note, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, label, category, String(input.vendor || '').trim().slice(0, 140) || null,
      scope, doctorId, amount, cadence, cashType, allocation, startsOn, endsOn,
      String(input.note || '').trim().slice(0, 500) || null, actor).run();
    return db.prepare('SELECT * FROM business_costs WHERE id = ?').bind(id).first();
  },

  async archive(db, id) {
    await db.prepare(
      `UPDATE business_costs SET active = 0, updated_at = ? WHERE id = ?`
    ).bind(nowIso(), id).run();
    return db.prepare('SELECT id, active FROM business_costs WHERE id = ?').bind(id).first();
  }
};

export const costs = {
  /* Which months have anything in them at all.

     The Money screen opens on the current month. In the first days of a
     month - or before a clinic has done anything - that is a page of
     zeroes, and a page of zeroes reads as a broken screen rather than as a
     quiet month. Knowing which months DO have activity lets the screen say
     which, instead of leaving the reader to guess. */
  async monthsWithActivity(db) {
    const { results } = await db.prepare(
      `SELECT DISTINCT substr(occurred_at, 1, 7) AS month
         FROM usage_events ORDER BY month DESC LIMIT 24`
    ).all();
    return (results || []).map(row => row.month);
  },

  /* One month, every clinic. `month` is 'YYYY-MM'; defaults to this one. */
  async report(db, month) {
    const period = /^\d{4}-\d{2}$/.test(String(month || ''))
      ? month : new Date().toISOString().slice(0, 7);

    const rateRows = await rates.list(db);
    const rateBy = Object.fromEntries(rateRows.map(r => [r.id, r]));

    /* Fixed costs exist whether or not anybody used anything. */
    const providerFixedPaise = rateRows
      .filter(r => r.unit === 'month')
      .reduce((sum, r) => sum + r.paise_per_unit, 0);

    const monthStart = period + '-01';
    const monthEnd = period + '-31';
    const { results: businessRows } = await db.prepare(
      `SELECT bc.*, d.clinic_name
         FROM business_costs bc
    LEFT JOIN doctors d ON d.id = bc.doctor_id
        WHERE bc.active = 1 AND bc.starts_on <= ?
          AND (bc.ends_on IS NULL OR bc.ends_on >= ?)`
    ).bind(monthEnd, monthStart).all();
    const businessLines = (businessRows || []).map(row => ({
      ...row, monthlyPaise: monthlyBusinessAmount(row, period)
    })).filter(row => row.monthlyPaise > 0);
    const sharedBusinessPaise = businessLines
      .filter(row => row.scope !== 'clinic')
      .reduce((sum, row) => sum + row.monthlyPaise, 0);
    const fixedPaise = providerFixedPaise + sharedBusinessPaise;

    const { results: clinics } = await db.prepare(
      `SELECT d.id, d.clinic_name, d.full_name, d.plan, d.product, d.status,
              d.created_at,
              COALESCE(p.paise_monthly, 0) AS plan_paise,
              (SELECT COUNT(*) FROM doctor_patients dp WHERE dp.doctor_id = d.id) AS patients
         FROM doctors d
    LEFT JOIN plan_prices p ON p.plan = d.plan
        ORDER BY d.created_at`
    ).all();

    /* Usage for the month, grouped. One query rather than one per clinic:
       a hundred clinics would otherwise be a hundred round trips. */
    const { results: usage } = await db.prepare(
      `SELECT doctor_id, event_type, SUM(quantity) AS quantity, COUNT(*) AS events
         FROM usage_events
        WHERE substr(occurred_at, 1, 7) = ?
        GROUP BY doctor_id, event_type`
    ).bind(period).all();

    const byDoctor = new Map();
    for (const row of (usage || [])) {
      if (!byDoctor.has(row.doctor_id)) byDoctor.set(row.doctor_id, []);
      byDoctor.get(row.doctor_id).push(row);
    }

    const active = (clinics || []).filter(c => c.status === 'active');
    /* Spread across ACTIVE clinics only - a suspended one is not why the
       Workers bill exists. Guard the divide: with no active clinics the
       fixed cost is still real, it just has nobody to attribute it to. */
    const fixedEach = active.length ? Math.round(fixedPaise / active.length) : 0;

    const lines = (clinics || []).map(clinic => {
      const events = byDoctor.get(clinic.id) || [];
      const usageCost = events.reduce(
        (sum, e) => sum + costOf(e.quantity, rateBy[e.event_type]), 0);

      const share = clinic.status === 'active' ? fixedEach : 0;
      const directBusiness = businessLines
        .filter(row => row.scope === 'clinic' && row.doctor_id === clinic.id)
        .reduce((sum, row) => sum + row.monthlyPaise, 0);
      const cost = usageCost + share + directBusiness;
      const revenue = clinic.plan_paise;

      return {
        doctorId: clinic.id,
        clinicName: clinic.clinic_name,
        doctor: clinic.full_name,
        plan: clinic.plan,
        product: clinic.product,
        status: clinic.status,
        patients: clinic.patients,
        revenuePaise: revenue,
        usageCostPaise: usageCost,
        fixedSharePaise: share,
        directBusinessPaise: directBusiness,
        costPaise: cost,
        marginPaise: revenue - cost,
        /* A free clinic has no margin to express as a percentage; saying
           -100% or Infinity there reads as a bug rather than as "this one
           is not paying yet". */
        marginPercent: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : null,
        breakdown: events.map(e => ({
          eventType: e.event_type,
          label: (rateBy[e.event_type] || {}).label || e.event_type,
          quantity: e.quantity,
          events: e.events,
          costPaise: costOf(e.quantity, rateBy[e.event_type]),
          /* Flags an event nobody has priced. Without this a whole cost
             category reads as free forever. */
          unpriced: !rateBy[e.event_type]
        })).sort((a, b) => b.costPaise - a.costPaise)
      };
    });

    const total = lines.reduce((sum, l) => ({
      revenuePaise: sum.revenuePaise + l.revenuePaise,
      costPaise: sum.costPaise + l.costPaise,
      usageCostPaise: sum.usageCostPaise + l.usageCostPaise
    }), { revenuePaise: 0, costPaise: 0, usageCostPaise: 0 });

    /* Which categories the money actually goes to. This is the view that
       settles the storage-versus-messaging argument with data. */
    const byCategory = {};
    for (const line of lines) {
      for (const item of line.breakdown) {
        const category = (rateBy[item.eventType] || {}).category || 'unpriced';
        byCategory[category] = (byCategory[category] || 0) + item.costPaise;
      }
    }
    byCategory.platform = (byCategory.platform || 0) + providerFixedPaise;
    for (const item of businessLines) {
      const key = item.cash_type === 'imputed'
        ? item.category + ' (imputed)' : item.category;
      byCategory[key] = (byCategory[key] || 0) + item.monthlyPaise;
    }

    return {
      period,
      clinics: lines,
      totals: {
        ...total,
        marginPaise: total.revenuePaise - total.costPaise,
        marginPercent: total.revenuePaise > 0
          ? Math.round(((total.revenuePaise - total.costPaise) / total.revenuePaise) * 100)
          : null,
        activeClinics: active.length,
        payingClinics: lines.filter(l => l.revenuePaise > 0).length,
        fixedPaise,
        cashCostPaise: businessLines.filter(row => row.cash_type === 'cash')
          .reduce((sum, row) => sum + row.monthlyPaise, 0) + providerFixedPaise +
          total.usageCostPaise,
        imputedCostPaise: businessLines.filter(row => row.cash_type === 'imputed')
          .reduce((sum, row) => sum + row.monthlyPaise, 0),
        /* What one more clinic costs at today's usage - the number that
           decides whether a discount is still profitable. */
        averageUsageCostPaise: active.length
          ? Math.round(total.usageCostPaise / active.length) : 0
      },
      byCategory,
      rates: rateRows,
      businessCosts: businessLines
    };
  }
};
