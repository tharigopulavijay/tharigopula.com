/* =========================================================================
   TCOS - product lines, plans, features and entitlements

   TWO PRODUCT LINES, sold to two different buyers:

     doctor  - one doctor, their own practice. Pays from their own pocket,
               decides alone. This is what we build and sell first.
     clinic  - a business with several doctors and staff. Needs seats, roles,
               a shared calendar and reception workflows. Comes later.

   Adding a second doctor is the natural trigger to move lines. That keeps
   the doctor plans clean: no seat maths, no roles, no "up to N doctors".

   The rule for plans: a plan is a PRESET, not a lock. Selecting one ticks a
   set of feature boxes; admin can then tick or untick any single box for one
   clinic. That is why "automatic on payment" and "manual override" are the
   same mechanism instead of two competing ones.

   Entitlement resolution order (last wins):
     plan defaults  ->  trial grants  ->  admin overrides
   ========================================================================= */
(() => {

  const PRODUCT_LINES = {
    doctor: {
      id: 'doctor',
      name: 'For Doctors',
      buyer: 'One doctor, their own practice',
      available: true
    },
    clinic: {
      id: 'clinic',
      name: 'For Clinics',
      buyer: 'A practice with several doctors and staff',
      available: false,
      note: 'Seats, staff roles, shared calendar and reception. Priced per doctor. Being designed after the doctor line is earning.'
    }
  };

  /* ---- the feature catalogue -------------------------------------------
     Every switchable capability. Adding one here makes it appear as a
     checkbox in the console automatically.                              */
  const FEATURE_GROUPS = [
    {
      id: 'practice', label: 'Running the practice',
      features: [
        { key: 'patients',       label: 'Patient records',           always: true },
        { key: 'appointments',   label: 'Appointments & calendar',   always: true },
        { key: 'prescriptions',  label: 'Branded prescriptions',     always: true },
        { key: 'practice_packs', label: 'Practice packs',            always: true },
        { key: 'lab_reports',    label: 'Lab reports & trend history' },
        { key: 'pharmacy',       label: 'Pharmacy stock, batch & expiry' },
        { key: 'billing',        label: 'Invoicing & payments' },
        { key: 'reports',        label: 'Monthly reports' }
      ]
    },
    {
      id: 'reach', label: 'Reaching patients',
      features: [
        { key: 'whatsapp',        label: 'WhatsApp reminders' },
        { key: 'website_connect', label: 'Booking from their website' },
        { key: 'patient_portal',  label: 'Patient portal access' },
        /* THE ONLY FEATURE THAT COSTS US MONEY PER CLINIC.
           Every other capability here is software: switching it on for one
           more doctor costs nothing. A doctor's own domain is different -
           Cloudflare bills per custom hostname, and an apex domain needs two
           of them (drclinic.com and www.drclinic.com).

           So it is deliberately in NO plan preset. It is granted per clinic
           from the owner console, to a doctor who has asked for it and is
           paying the add-on. A doctor who signs up, connects a domain and
           abandons it still costs us every month until it is deleted -
           Cloudflare bills hostnames that are merely pending. */
        { key: 'custom_domain',   label: 'Their own domain name',
          addon: true, pricePaise: 5000, ownerOnly: true }
      ]
    },
    {
      id: 'automation', label: 'Automation',
      features: [
        { key: 'automation_basic',    label: 'Follow-up & reminder rules' },
        { key: 'automation_advanced', label: 'Multi-step rules with approvals' }
      ]
    },
    {
      id: 'ai', label: 'AI',
      features: [
        { key: 'ai_lab_extract', label: 'Read lab reports from photo or PDF' },
        { key: 'ai_voice_rx',    label: 'Voice to prescription draft' },
        { key: 'ai_summary',     label: 'Summarise patient history' },
        { key: 'ai_copilot',     label: 'Ask-anything copilot' },
        { key: 'insights',       label: 'Practice insights & anomaly alerts' }
      ]
    },
    {
      id: 'branding', label: 'Branding & access',
      features: [
        { key: 'white_label', label: 'Remove "Powered by TCOS"' },
        { key: 'api_access',  label: 'API access' },
        { key: 'priority_support', label: 'Priority support' }
      ]
    },
    {
      id: 'clinic_only', label: 'Clinic line only',
      line: 'clinic',
      features: [
        { key: 'staff_logins',   label: 'Staff & reception logins' },
        { key: 'multi_doctor',   label: 'Several doctors in one practice' },
        { key: 'shared_calendar', label: 'Shared clinic calendar' },
        { key: 'multi_location', label: 'Multiple branches' }
      ]
    }
  ];

  const ALL_FEATURES = FEATURE_GROUPS.flatMap(g => g.features);
  const FEATURE_LABEL = Object.fromEntries(ALL_FEATURES.map(f => [f.key, f.label]));
  const ALWAYS_ON = ALL_FEATURES.filter(f => f.always).map(f => f.key);

  /* Groups shown for a given line - the clinic-only group stays hidden
     while a tenant is on the doctor line. */
  const groupsForLine = lineId =>
    FEATURE_GROUPS.filter(g => !g.line || g.line === lineId);

  /* ---- the doctor line --------------------------------------------------

     Priced against published competitor rates, checked 5 Sep 2026: Halemind
     ₹625, Adrine ₹999 WITH an AI scribe, Halemind Standard ₹1,666, MocDoc
     from ₹2,500, Practo Ray ₹1,000-4,000 plus ₹1,500-3,000 a month in
     per-appointment fees.

     AI READING IS NOW IN EVERY PAID PLAN. It used to sit only in the top
     tier, which made sense when a report was believed to cost ₹77 to read.
     It costs about ₹3. At that price metering buys nothing and costs
     adoption: a doctor who weighs the price before uploading a report never
     forms the habit, and the habit is the product.

     ONLY FEATURES THAT EXIST ARE LISTED. whatsapp, ai_voice_rx, ai_copilot,
     automation_advanced, white_label and api_access were all being sold on
     this screen and none of them are built. Selling somebody something that
     does not exist is how the first renewal conversation goes badly. They
     come back when they are real. */
  const PLANS = {
    basic: {
      id: 'basic',
      line: 'doctor',
      name: 'Free',
      tagline: 'Run your clinic on it, free, forever',
      priceMonthly: 0,
      priceYearly: 0,
      currency: 'INR',
      limits: { activePatients: null, prescriptionsPerMonth: null, storageMb: 200, aiRuns: 0,
                 doctors: 1, staff: 1 },
      /* It can stay free because the two things that cost money per use -
         reading documents and sending messages - are the ones left out.
         Nothing expires. */
      pitch: 'Everything you need to see patients and hand them a proper prescription. Not a trial — it stays free.',
      features: [...ALWAYS_ON]
    },
    starter: {
      id: 'starter',
      line: 'doctor',
      name: 'Practice',
      tagline: 'Your whole clinic, running properly',
      priceMonthly: 899,
      priceYearly: 8990,
      currency: 'INR',
      limits: { activePatients: null, prescriptionsPerMonth: null, storageMb: 5120, aiRuns: 60,
                 doctors: 1, staff: 3 },
      pitch: 'Pharmacy, billing and reports — and hand it a lab report instead of typing sixty numbers.',
      features: [
        ...ALWAYS_ON,
        'lab_reports', 'pharmacy', 'billing', 'reports',
        'website_connect', 'patient_portal', 'staff_logins',
        'ai_lab_extract'
      ]
    },
    pro: {
      id: 'pro',
      line: 'doctor',
      name: 'Clinic',
      tagline: 'More doctors, more hands, your own address',
      priceMonthly: 2199,
      priceYearly: 21990,
      currency: 'INR',
      limits: { activePatients: null, prescriptionsPerMonth: null, storageMb: 20480, aiRuns: 250,
                 doctors: 3, staff: 8 },
      pitch: 'Up to three doctors and eight staff, on your own domain, with the diary shared between them.',
      features: [
        ...ALWAYS_ON,
        'lab_reports', 'pharmacy', 'billing', 'reports',
        'website_connect', 'patient_portal', 'staff_logins',
        'ai_lab_extract', 'ai_summary',
        'multi_doctor', 'shared_calendar', 'automation_basic'
      ]
    },
    pro_plus: {
      id: 'pro_plus',
      line: 'doctor',
      name: 'Group',
      tagline: 'Several places, one practice',
      priceMonthly: 4499,
      priceYearly: 44990,
      currency: 'INR',
      limits: { activePatients: null, prescriptionsPerMonth: null, storageMb: 51200, aiRuns: 700,
                 doctors: 25, staff: 50 },
      /* Said "Unlimited doctors and staff" until 8 Sep 2026. The plan is
         enforced at 25 doctors and 50 staff in migration 030, so the page
         promised something the software would refuse - and it would have
         refused it at the counter, in front of a group that had already
         paid. The number a clinic is held to is the number it is sold. */
      pitch: 'Up to 25 doctors and 50 staff across locations, with reading included at the volume a busy group actually uses.',
      features: [
        ...ALWAYS_ON,
        'lab_reports', 'pharmacy', 'billing', 'reports',
        'website_connect', 'patient_portal', 'staff_logins',
        'ai_lab_extract', 'ai_summary', 'insights',
        'multi_doctor', 'shared_calendar', 'multi_location',
        'automation_basic', 'priority_support'
      ]
    }
  };

  const PLAN_ORDER = ['basic', 'starter', 'pro', 'pro_plus'];
  const plansForLine = lineId =>
    PLAN_ORDER.map(id => PLANS[id]).filter(p => p.line === lineId);

  /* ---- bigger than Group ------------------------------------------------

     A hospital, a chain, or a group past 25 doctors has no card to click,
     and the honest answer is a conversation rather than a number: their
     seats, volumes and terms get set by hand.

     DELIBERATELY NOT IN `PLANS` OR `PLAN_ORDER`. Entitlements, trials and
     the admin console all walk those, and a plan nobody can be ON would be
     a special case in every one of them. This is a card on the pricing
     screen, not a plan - there is no price, no Razorpay plan and no row in
     plan_limits, because none of those would ever be used.

     WHAT IT DOES NOT CLAIM. No feature that Group does not already have.
     What it actually offers is that the ceiling is negotiable, which is
     true: a plan is a preset, and the console can raise any single limit
     for one clinic. Anything more than that would be a promise the software
     has no way to keep. */
  const CONTACT_PLAN = {
    id: 'enterprise',
    line: 'doctor',
    name: 'Enterprise',
    tagline: 'Bigger than Group, or a shape we have not met yet',
    contactOnly: true,
    pitch: 'More than 25 doctors, several companies, or volumes past what ' +
      'Group covers. We set the numbers with you and agree terms directly.',
    scope: 'Your numbers · agreed with you',
    /* Statements about how we work, not switches in the software - which is
       why they are written out rather than taken from the feature list. */
    points: [
      'Everything in Group',
      'Seats, patients and storage set to your numbers',
      'Onboarding and data migration handled with you',
      'A written agreement, invoicing and payment terms to suit'
    ],
    cta: 'Talk to us'
  };

  /* ---- trials -----------------------------------------------------------
     A trial temporarily grants a higher plan's features and carries a date.
     When it lapses the doctor falls back to their PAID plan - never to
     nothing, and never with data removed. */
  const TRIAL_OFFERS = {
    trial_7_pro_plus:  { id: 'trial_7_pro_plus',  label: '7-day Pro+ trial',  days: 7,  grantsPlan: 'pro_plus' },
    trial_14_pro_plus: { id: 'trial_14_pro_plus', label: '14-day Pro+ trial', days: 14, grantsPlan: 'pro_plus' },
    trial_30_pro:      { id: 'trial_30_pro',      label: '30-day Pro trial',  days: 30, grantsPlan: 'pro' }
  };

  const today = () => new Date().toISOString().slice(0, 10);

  function daysLeft(endsOn) {
    if (!endsOn) return null;
    const ms = new Date(endsOn + 'T23:59:59') - new Date();
    return Math.max(0, Math.ceil(ms / 86400000));
  }

  const trialActive = clinic =>
    !!(clinic && clinic.trial && clinic.trial.endsOn && daysLeft(clinic.trial.endsOn) > 0);

  /* ---- resolution -------------------------------------------------------
     One function decides what a tenant can actually do. Everything in the
     product asks this and nothing else. */
  function entitlements(clinic) {
    if (!clinic) return new Set(ALWAYS_ON);
    const paidPlan = PLANS[clinic.plan] || PLANS.basic;
    const granted = new Set(paidPlan.features);

    if (trialActive(clinic)) {
      const offer = TRIAL_OFFERS[clinic.trial.offer];
      const trialPlan = PLANS[(offer && offer.grantsPlan) || 'pro_plus'];
      trialPlan.features.forEach(f => granted.add(f));
    }

    Object.entries(clinic.featureOverrides || {}).forEach(([key, on]) => {
      if (on) granted.add(key); else granted.delete(key);
    });

    /* Clinic-line capabilities never leak onto a doctor-line tenant. */
    if ((clinic.line || 'doctor') !== 'clinic') {
      FEATURE_GROUPS.filter(g => g.line === 'clinic')
        .flatMap(g => g.features)
        .forEach(f => granted.delete(f.key));
    }

    ALWAYS_ON.forEach(f => granted.add(f));
    return granted;
  }

  const can = (clinic, featureKey) => entitlements(clinic).has(featureKey);

  function effectivePlan(clinic) {
    if (trialActive(clinic)) {
      const offer = TRIAL_OFFERS[clinic.trial.offer];
      const planId = (offer && offer.grantsPlan) || 'pro_plus';
      return { ...PLANS[planId], viaTrial: true, daysLeft: daysLeft(clinic.trial.endsOn) };
    }
    return PLANS[clinic.plan] || PLANS.basic;
  }

  function overriddenKeys(clinic) {
    if (!clinic || !clinic.featureOverrides) return [];
    const base = new Set((PLANS[clinic.plan] || PLANS.basic).features);
    return Object.entries(clinic.featureOverrides)
      .filter(([key, on]) => base.has(key) !== on)
      .map(([key]) => key);
  }

  /* Adding a second doctor is what moves a tenant to the clinic line. */
  function needsClinicLine(clinic, doctorCount) {
    return (clinic.line || 'doctor') === 'doctor' && doctorCount > 1;
  }

  function startTrial(clinic, offerId) {
    const offer = TRIAL_OFFERS[offerId];
    if (!offer) throw new Error('Unknown trial offer.');
    const ends = new Date();
    ends.setDate(ends.getDate() + offer.days);
    return { offer: offerId, startedOn: today(), endsOn: ends.toISOString().slice(0, 10) };
  }

  const formatPrice = plan => plan.priceMonthly === 0
    ? 'Free'
    : '₹' + plan.priceMonthly.toLocaleString('en-IN') + '/mo';

  const formatYearly = plan => plan.priceYearly
    ? '₹' + plan.priceYearly.toLocaleString('en-IN') + '/yr - two months free'
    : '';

  /* Paid extras that sit outside the plan ladder, because they cost us real
     money for each clinic that uses them rather than being software we have
     already written. Priced in paise like everything else. */
  const ADDONS = ALL_FEATURES.filter(f => f.addon);
  const addon = key => ADDONS.find(a => a.key === key) || null;
  const formatAddon = key => {
    const a = addon(key);
    return a ? '₹' + (a.pricePaise / 100).toLocaleString('en-IN') + '/month' : '';
  };

  window.TCOSPlans = {
    PRODUCT_LINES, FEATURE_GROUPS, ALL_FEATURES, FEATURE_LABEL, ALWAYS_ON,
    groupsForLine, PLANS, PLAN_ORDER, plansForLine, CONTACT_PLAN, TRIAL_OFFERS,
    ADDONS, addon, formatAddon,
    entitlements, can, effectivePlan, overriddenKeys, needsClinicLine,
    trialActive, daysLeft, startTrial, formatPrice, formatYearly
  };
})();
