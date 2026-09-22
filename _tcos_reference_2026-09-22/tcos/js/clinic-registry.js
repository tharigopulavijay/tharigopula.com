/* =========================================================================
   TCOS - clinic registry: one codebase, many clinics, three products.

   Three layers:
     1. CORE_SECTIONS   - every doctor gets these, whatever she practises
     2. PRACTICE_PACKS  - switched on by what the doctor actually practises
     3. the clinic      - branding + enabled packs, held in the database

   Onboarding a new doctor = a row and a pack list. No new code, no new repo.
   The product she signs into (AyurCOS / HomeoCOS / AlloCOS) decides which
   packs she starts with and which medicine system she sees first; see
   js/products.js. It never decides what she is allowed to prescribe.
   ========================================================================= */
(() => {

  /* -- Layer 1: common to every doctor ----------------------------------
     Medicines and investigations live here on purpose. An Ayurvedic doctor
     prescribes Metformin; a homeopath orders the same lab panels. The
     medicine record carries a `system` field rather than being split into
     separate Ayurvedic, homeopathic and allopathic tables.               */
  const CORE_SECTIONS = [
    { id: 'vitals', title: 'Vitals & Examination',
      fields: ['Blood pressure', 'Pulse', 'Weight', 'Temperature'] },
    { id: 'complaints', title: 'Complaints & Diagnosis',
      fields: ['Presenting complaints', 'Duration', 'Provisional diagnosis'] },
    { id: 'medicines', title: 'Medicines', kind: 'medicines' },
    { id: 'investigations', title: 'Investigations Advised', kind: 'labs' },
    { id: 'advice', title: 'Advice & Diet',
      fields: ['Diet', 'Activity', 'General advice'] },
    { id: 'followup', title: 'Follow-up',
      fields: ['Next review', 'Mode'] }
  ];

  /* Medicine systems - ONE list, and every clinic draws from all of it.

     A product may put its own system first (js/products.js decides the
     order); no product removes a system from this list. A homeopath whose
     patient is already on allopathic thyroxine has to be able to record
     that, or the medication history is a lie by omission. */
  const MEDICINE_SYSTEMS = [
    { id: 'allopathy', label: 'Allopathic' },
    { id: 'ayurveda', label: 'Ayurvedic' },
    { id: 'homeopathy', label: 'Homeopathic' },
    { id: 'supplement', label: 'Supplement' }
  ];

  /* -- Layer 2: practice packs ------------------------------------------
     Each pack adds sections to the consultation and the prescription. A
     clinic enables only the packs it practises. Nothing here is specific
     to one customer, and nothing here is specific to one product either -
     an Ayurveda doctor who also does acupuncture switches that pack on. */
  const PRACTICE_PACKS = {

    /* ---------------------------------------------------- Ayurveda ---- */
    ayurveda: {
      label: 'Ayurveda',
      discipline: 'ayurveda',
      sections: [
        { id: 'ayurveda-assessment', title: 'Ayurveda Assessment',
          fields: ['Prakriti', 'Vikriti', 'Dosha status', 'Agni', 'Koshtha',
            'Ama', 'Srotas involved', 'Roga bala', 'Rogi bala'] },
        { id: 'ahara-vihara', title: 'Ahara & Vihara',
          fields: ['Appetite', 'Diet pattern', 'Bowel pattern', 'Sleep',
            'Daily activity', 'Stress / Manas', 'Pathya', 'Apathya'] },
        { id: 'ayurvedic-formulations', title: 'Ayurvedic Formulations',
          fields: ['Kashaya / Kwatha', 'Churna', 'Asava / Arishta',
            'Ghrita / Taila', 'Vati / Guggulu', 'Avaleha / Lehya', 'Arka',
            'Anupana'] }
      ]
    },
    nadi: {
      label: 'Nadi Pariksha',
      discipline: 'ayurveda',
      sections: [{
        id: 'nadi', title: 'Nadi Pariksha',
        fields: ['Nadi - left', 'Nadi - right', 'Gati', 'Bala', 'Tala',
          'Jihva', 'Sparsha', 'Drik', 'Akriti', 'Nails']
      }]
    },
    panchakarma: {
      label: 'Panchakarma',
      discipline: 'ayurveda',
      sections: [{
        id: 'panchakarma', title: 'Panchakarma Plan',
        fields: ['Purvakarma', 'Pradhanakarma', 'Paschatkarma',
          'Duration', 'Sessions advised', 'Precautions']
      }]
    },

    /* -------------------------------------------------- Homeopathy ---- */
    homeopathy: {
      label: 'Homeopathy',
      discipline: 'homeopathy',
      sections: [
        { id: 'case-taking', title: 'Case Taking & Totality',
          fields: ['Mentals', 'Physical generals', 'Particulars',
            'Modalities - worse', 'Modalities - better', 'Thermal reaction',
            'Thirst & appetite', 'Sleep & dreams', 'Miasm'] },
        { id: 'homeo-prescription', title: 'Remedy',
          fields: ['Remedy', 'Potency', 'Repetition', 'Placebo / SL',
            'Antidote precautions'] }
      ]
    },
    repertory: {
      label: 'Repertorisation',
      discipline: 'homeopathy',
      sections: [{
        id: 'repertory', title: 'Repertorisation',
        fields: ['Rubrics taken', 'Remedies considered', 'Differential',
          'Selected remedy', 'Reason for selection']
      }]
    },
    constitution: {
      label: 'Constitutional Assessment',
      discipline: 'homeopathy',
      sections: [{
        id: 'constitution', title: 'Constitution',
        fields: ['Constitutional type', 'Diathesis', 'Family miasm',
          'Susceptibility', 'Direction of cure']
      }]
    },

    /* --------------------------------------------------- Allopathy ---- */
    systemic: {
      label: 'Systemic Examination',
      discipline: 'allopathy',
      sections: [{
        id: 'systemic', title: 'Systemic Examination',
        fields: ['Cardiovascular', 'Respiratory', 'Central nervous system',
          'Per abdomen', 'Local examination', 'General condition']
      }]
    },
    history: {
      label: 'Detailed History',
      discipline: 'allopathy',
      sections: [{
        id: 'history', title: 'History',
        fields: ['Past history', 'Family history', 'Personal history',
          'Known allergies', 'Current medication', 'Immunisation']
      }]
    },
    procedure: {
      label: 'Procedures',
      discipline: 'allopathy',
      sections: [{
        id: 'procedure', title: 'Procedure Record',
        fields: ['Procedure performed', 'Findings', 'Consent taken',
          'Complications', 'Post-procedure advice']
      }]
    },

    /* ------------------------------------- shared across disciplines --- */
    acupuncture: {
      label: 'Acupuncture',
      sections: [{
        id: 'acupuncture', title: 'Acupuncture / Acupressure',
        fields: ['Points treated', 'Technique', 'Sessions advised']
      }]
    },
    chiropractic: {
      label: 'Chiropractic',
      sections: [{
        id: 'chiropractic', title: 'Chiropractic Care',
        fields: ['Spinal levels adjusted', 'Technique', 'Sessions advised']
      }]
    },
    yoga: {
      label: 'Therapeutic Yoga',
      sections: [{
        id: 'yoga', title: 'Yoga & Pranayama Plan',
        fields: ['Asana sequence', 'Pranayama', 'Meditation',
          'Contraindications', 'Duration', 'Frequency']
      }]
    },
    physiotherapy: {
      label: 'Physiotherapy',
      sections: [{
        id: 'physio', title: 'Physiotherapy Plan',
        fields: ['Exercises', 'Modalities', 'Sessions advised']
      }]
    },
    referral: {
      label: 'Referrals',
      sections: [{
        id: 'referral', title: 'Referral',
        fields: ['Refer to', 'Reason']
      }]
    }
  };

  /* Findings are what the doctor OBSERVES, so they belong above the shared
     clinical core; plans and formulations follow the medicines they modify.
     Each discipline reads its own examination first - a homeopath's case
     taking is the consultation, not an addendum to it. */
  const FINDING_SECTIONS = new Set([
    'nadi', 'ayurveda-assessment', 'case-taking', 'repertory',
    'constitution', 'systemic', 'history'
  ]);

  function resolveLayout(packs) {
    const packSections = (packs || [])
      .map(id => PRACTICE_PACKS[id])
      .filter(Boolean)
      .flatMap(pack => pack.sections);

    const findings = packSections.filter(s => FINDING_SECTIONS.has(s.id));
    const plans = packSections.filter(s => !FINDING_SECTIONS.has(s.id));
    const core = CORE_SECTIONS;

    return {
      sections: [
        core[0], core[1],
        ...findings,
        core[2],
        ...plans,
        core[3], core[4], core[5]
      ]
    };
  }

  function packLabels(packs) {
    return (packs || [])
      .map(id => PRACTICE_PACKS[id] && PRACTICE_PACKS[id].label)
      .filter(Boolean);
  }

  /* Every pack, grouped so the practice screen can show "yours", then the
     rest of your discipline, then what other disciplines use. Nothing is
     hidden: a doctor may request any pack, and the platform approves it. */
  function packsForDiscipline(discipline) {
    return Object.entries(PRACTICE_PACKS).map(([id, pack]) => ({
      id,
      label: pack.label,
      discipline: pack.discipline || 'shared',
      ownDiscipline: !pack.discipline || pack.discipline === discipline
    }));
  }

  /* Medicine systems in the order this product should show them. The
     product's own system leads; the rest follow in their standard order.
     Nothing is removed. */
  function medicineSystemsFor(product) {
    const first = product && product.medicineFirst;
    if (!first) return MEDICINE_SYSTEMS.slice();
    return [
      ...MEDICINE_SYSTEMS.filter(s => s.id === first),
      ...MEDICINE_SYSTEMS.filter(s => s.id !== first)
    ];
  }

  window.ClinicRegistry = {
    CORE_SECTIONS, PRACTICE_PACKS, MEDICINE_SYSTEMS,
    resolveLayout, packLabels, packsForDiscipline, medicineSystemsFor
  };
})();
