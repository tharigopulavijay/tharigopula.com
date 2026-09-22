/* =========================================================================
   Lab panels.

   The reason this exists: a doctor will not type twenty-five analyte names
   and reference ranges from a printed report. They will do it once, decide
   it is not worth it, and go back to filing the paper.

   So they pick a panel, the rows appear already named with their reference
   ranges, and they type only the numbers. A lipid profile becomes five
   numbers instead of five names, five ranges, five units and five numbers.

   Ranges are the common adult values used by Indian laboratories. They are a
   starting point printed on the row, not a diagnosis - the doctor can change
   any of them, because real reports differ by lab, by method, and by whether
   the patient is pregnant, elderly or a child.
   ========================================================================= */
(() => {

  /* low/high are used to flag a value automatically. Where a range cannot be
     expressed as two numbers, low/high are left out and nothing is flagged. */
  const PANELS = {
    glycaemic: {
      label: 'Glycaemic profile',
      analytes: [
        { name: 'Fasting glucose', unit: 'mg/dL', reference: '70–99', low: 70, high: 99 },
        { name: 'Post-prandial glucose', unit: 'mg/dL', reference: '<140', high: 140 },
        { name: 'HbA1c', unit: '%', reference: '4.0–5.6', low: 4.0, high: 5.6 }
      ]
    },
    lipid: {
      label: 'Lipid profile',
      analytes: [
        { name: 'Total cholesterol', unit: 'mg/dL', reference: '<200', high: 200 },
        { name: 'LDL cholesterol', unit: 'mg/dL', reference: '<100', high: 100 },
        { name: 'HDL cholesterol', unit: 'mg/dL', reference: '>50', low: 50 },
        { name: 'Triglycerides', unit: 'mg/dL', reference: '<150', high: 150 },
        { name: 'VLDL cholesterol', unit: 'mg/dL', reference: '5–40', low: 5, high: 40 }
      ]
    },
    cbc: {
      label: 'Complete blood count',
      analytes: [
        { name: 'Haemoglobin', unit: 'g/dL', reference: '12.0–15.5', low: 12, high: 15.5 },
        { name: 'Total WBC', unit: '/µL', reference: '4,000–11,000', low: 4000, high: 11000 },
        { name: 'Platelets', unit: '×10³/µL', reference: '150–450', low: 150, high: 450 },
        { name: 'ESR', unit: 'mm/hr', reference: '0–20', high: 20 }
      ]
    },
    liver: {
      label: 'Liver function',
      analytes: [
        { name: 'Bilirubin – total', unit: 'mg/dL', reference: '0.3–1.2', low: 0.3, high: 1.2 },
        { name: 'SGPT / ALT', unit: 'U/L', reference: '0–35', high: 35 },
        { name: 'SGOT / AST', unit: 'U/L', reference: '0–35', high: 35 },
        { name: 'Alkaline phosphatase', unit: 'U/L', reference: '30–120', low: 30, high: 120 },
        { name: 'Total protein', unit: 'g/dL', reference: '6.0–8.3', low: 6, high: 8.3 },
        { name: 'Albumin', unit: 'g/dL', reference: '3.5–5.0', low: 3.5, high: 5 }
      ]
    },
    kidney: {
      label: 'Kidney function',
      analytes: [
        { name: 'Urea', unit: 'mg/dL', reference: '15–40', low: 15, high: 40 },
        { name: 'Creatinine', unit: 'mg/dL', reference: '0.6–1.1', low: 0.6, high: 1.1 },
        { name: 'Uric acid', unit: 'mg/dL', reference: '2.6–6.0', low: 2.6, high: 6 },
        { name: 'eGFR', unit: 'mL/min', reference: '>90', low: 90 }
      ]
    },
    thyroid: {
      label: 'Thyroid profile',
      analytes: [
        { name: 'TSH', unit: 'mIU/L', reference: '0.4–4.0', low: 0.4, high: 4 },
        { name: 'Free T3', unit: 'pg/mL', reference: '2.0–4.4', low: 2, high: 4.4 },
        { name: 'Free T4', unit: 'ng/dL', reference: '0.8–1.8', low: 0.8, high: 1.8 }
      ]
    },
    vitamins: {
      label: 'Vitamins & minerals',
      analytes: [
        { name: 'Vitamin D (25-OH)', unit: 'ng/mL', reference: '30–100', low: 30, high: 100 },
        { name: 'Vitamin B12', unit: 'pg/mL', reference: '200–900', low: 200, high: 900 },
        { name: 'Calcium', unit: 'mg/dL', reference: '8.8–10.6', low: 8.8, high: 10.6 },
        { name: 'Iron', unit: 'µg/dL', reference: '60–170', low: 60, high: 170 }
      ]
    },
    blank: { label: 'Something else — enter it myself', analytes: [] }
  };

  /* A value outside its range is flagged so the doctor is not left to spot it
     by eye across thirty rows. Anything that is not a plain number - "Trace",
     "Nil", "Not detected" - is left alone rather than guessed at. */
  function flagFor(analyte, rawValue) {
    const value = parseFloat(String(rawValue).replace(/,/g, ''));
    if (!isFinite(value)) return 'normal';
    if (analyte.high != null && value > analyte.high) return 'high';
    if (analyte.low != null && value < analyte.low) return 'low';
    return 'normal';
  }

  /* Direction of travel between two readings, for the trend column. Which
     direction is good depends on the analyte, so this reports movement only
     and leaves the meaning to the doctor. */
  function movement(previous, current) {
    const a = parseFloat(String(previous).replace(/,/g, ''));
    const b = parseFloat(String(current).replace(/,/g, ''));
    if (!isFinite(a) || !isFinite(b) || a === b) return null;
    const change = b - a;
    const rounded = Math.abs(change) < 1
      ? Math.round(Math.abs(change) * 100) / 100
      : Math.round(Math.abs(change) * 10) / 10;
    return { direction: change > 0 ? 'up' : 'down', by: rounded };
  }

  window.LabPanels = { PANELS, flagFor, movement, list: () => Object.entries(PANELS) };
})();
