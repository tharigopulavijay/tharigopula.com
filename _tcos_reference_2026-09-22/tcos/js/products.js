/* =========================================================================
   TCOS - the three products.

   AyurCOS, HomeoCOS and AlloCOS are ONE codebase, one API and one database
   wearing three faces. This file is the whole of the difference between
   them: a name, a logo, a palette, which practice packs are on by default,
   and which medicine system the doctor sees first.

   What is deliberately NOT here, because it is shared:

     patients        one person, one record. He may see an Ayurveda doctor
                     in March and an allopath in June, and it is still him.
     medicines       every system, one catalogue. An Ayurvedic doctor
                     prescribes Metformin and a homeopath needs to SEE that
                     she does, or nobody catches the interaction.
     billing, pharmacy, stock, labs, appointments, consent, the platform
     console, tenant isolation, the permission gates.

   The rule this file exists to hold: isolate what the doctor SEES, share
   what the patient IS. A product may reorder or preselect a medicine
   system. No product may remove one - an earlier Ayurveda-only build
   deleted homeopathy from the list, and that is precisely the fork this
   design exists to prevent.

   Adding a fourth discipline (Unani, Siddha, Naturopathy) is an entry in
   this object. It is never a new repository.
   ========================================================================= */
(() => {

  const PRODUCTS = {
    ayurcos: {
      id: 'ayurcos',
      name: 'AyurCOS',
      full: 'Ayurveda Clinical Operating System',
      discipline: 'Ayurveda',
      logo: 'assets/ayurcos-logo.png',
      /* The one thing about the PRESCRIPTION that differs by product.
       *
         Vijay: "just the colouring changes, else that also same across all -
         it is better keep consistent, the presentation all consistent."
       *
         Sampled from the product's own logo artwork rather than invented,
         so a doctor's sheet matches the mark at the top of her screen.
         Everything else on the sheet - the layout, the fields she can add,
         the six that print, where the letterhead goes - is one shared
         component and stays byte-identical across all three. */
      accent: '#027256',
      accentSoft: '#E6F3F0',
      /* Which medicine system is preselected and listed first. Every system
         stays searchable - this is an ordering, not a filter. */
      medicineFirst: 'ayurveda',
      /* Packs a new doctor on this product starts with. She can request
         others; packs are approved by the platform, never self-served. */
      defaultPacks: ['ayurveda', 'nadi', 'yoga', 'referral'],
      /* Wording that differs by discipline. Anything absent falls back to
         the shared label. */
      labels: {
        reports: 'Diagnostics',
        practice: 'Clinic setup',
        medicines: 'Medicines & Formulations'
      },
      /* Registration bodies differ, and the certificate screen says so. */
      council: 'AYUSH / State Ayurveda Council',
      qualificationHint: 'BAMS, MD (Ayurveda)',
      signIn: {
        eyebrow: 'Complete Ayurveda clinic management',
        headline: 'From first consultation to every follow-up.',
        lead: 'Run the clinical, pharmacy and business side of your Ayurveda ' +
          'practice from one secure workspace - while patients receive a clear ' +
          'record they can understand.',
        benefits: [
          ['Ayurveda-first clinical records',
            'Prakriti, Vikriti, Dosha, Agni, Koshtha, Ama, Srotas and complete Nadi Pariksha.'],
          ['Complete prescriptions',
            'Ayurvedic formulations, supplements and appropriate allopathic medicines in one prescription, each with its source named.'],
          ['Pharmacy and practice operations',
            'Batch and expiry stock, FEFO dispensing, appointments, billing, QR/card/cash payments and staff access.'],
          ['A useful patient record',
            'Patients review prescriptions, advice, diagnostic history and follow-up plans without editing anything.']
        ]
      }
    },

    homeocos: {
      id: 'homeocos',
      name: 'HomeoCOS',
      full: 'Homeopathy Clinical Operating System',
      discipline: 'Homeopathy',
      logo: 'assets/homeocos-logo.png',
      accent: '#5035B7',
      accentSoft: '#EFECFB',
      medicineFirst: 'homeopathy',
      defaultPacks: ['homeopathy', 'repertory', 'referral'],
      labels: {
        reports: 'Diagnostics',
        practice: 'Clinic setup',
        medicines: 'Remedies'
      },
      council: 'CCH / State Homoeopathy Council',
      qualificationHint: 'BHMS, MD (Hom)',
      signIn: {
        eyebrow: 'Complete homeopathy clinic management',
        headline: 'The whole case, not just the last visit.',
        lead: 'Case taking, repertorisation and remedy history in one place - ' +
          'so the totality you built over six visits is still in front of you ' +
          'on the seventh.',
        benefits: [
          ['Case taking that holds the totality',
            'Mentals, generals, particulars, modalities, thermals, dreams and miasm, carried forward visit to visit.'],
          ['Repertorisation you can revisit',
            'Rubrics, remedies considered, the differential and why you chose what you chose - recorded, not remembered.'],
          ['Remedy, potency and repetition',
            'Every prescription numbered and immutable, with the patient\'s full remedy history beside it.'],
          ['What else they are taking',
            'Allopathic medicines a patient is already on are visible here, because they change the case.']
        ]
      }
    },

    allocos: {
      id: 'allocos',
      name: 'AlloCOS',
      full: 'Allopathy Clinical Operating System',
      discipline: 'Allopathy',
      logo: 'assets/allocos-logo.png',
      accent: '#005FBB',
      accentSoft: '#E6F1FB',
      medicineFirst: 'allopathy',
      defaultPacks: ['systemic', 'history', 'referral'],
      labels: {
        reports: 'Diagnostics',
        practice: 'Clinic setup',
        medicines: 'Medicines'
      },
      council: 'NMC / State Medical Council',
      qualificationHint: 'MBBS, MD',
      signIn: {
        eyebrow: 'Complete clinic management',
        headline: 'The record, the pharmacy and the day, in one place.',
        lead: 'Consultation notes, prescriptions, stock, billing and the ' +
          'appointment diary in a single workspace - built for a clinic run ' +
          'by one doctor and two or three staff.',
        benefits: [
          ['Clinical records that keep up',
            'History, systemic examination, provisional and differential diagnosis, and every past visit a click away.'],
          ['Prescriptions and interactions',
            'A molecule catalogue as a typing aid, immutable numbered prescriptions, and the patient\'s full medication history including what other doctors added.'],
          ['Pharmacy and billing',
            'Batch and expiry stock, FEFO dispensing, gap-free invoices, QR/card/cash payments.'],
          ['Staff who can help without seeing everything',
            'Front desk, pharmacy and assistant duties assigned by you. None of them can open a clinical record.']
        ]
      }
    }
  };

  /* Before anyone signs in we do not know which product they belong to, and
     guessing is worse than not guessing: an allopath landing on an Ayurveda
     sign-in page assumes she is in the wrong place. So the neutral platform
     identity is what an unrecognised visitor sees. It is not something a
     doctor can be activated on - it is the front door. */
  const PLATFORM = {
    id: 'tcos',
    name: 'TCOS',
    full: 'Clinical Operating System',
    discipline: null,
    logo: 'assets/tcos-logo.png',
    /* The neutral sheet, for a document rendered before we know whose it
       is. Green, which is what every prescription looked like before the
       three products had their own. */
    accent: '#1F5C42',
    accentSoft: '#E8F1EB',
    medicineFirst: null,
    defaultPacks: [],
    labels: {},
    signIn: {
      eyebrow: 'Clinic management for Indian practices',
      headline: 'Run your whole clinic from one screen.',
      lead: 'Appointments, records, prescriptions, pharmacy and billing. ' +
        'Sign in and we will take you to your practice.',
      benefits: [
        ['Your discipline, properly',
          'Ayurveda, Homeopathy and Allopathy each get a consultation built for how that system actually works.'],
        ['One patient, one history',
          'If your patient also sees another TCOS doctor, their medication history is complete - with their consent.'],
        ['Your team, your rules',
          'You decide what front desk and pharmacy can open. No member of staff can read a clinical record.'],
        ['Your records stay yours',
          'Issued prescriptions and invoices are numbered and frozen. Nothing is edited behind your back.']
      ]
    }
  };

  const DEFAULT_PRODUCT = 'ayurcos';
  const REMEMBERED = 'tcos.product';

  /* Which product is this page? In order of authority:

       1. the signed-in doctor's own product, set by the platform when the
          account was verified and activated. This is the real answer.
       2. ?product= in the URL, or a value stashed in localStorage - so one
          local server can demonstrate all three without three deployments.
       3. the default.

     A doctor cannot change her own product: it follows her registration,
     and switching it would change what her prescriptions claim she is
     qualified to issue. Only the platform sets it. */
  function resolve(doctor) {
    if (doctor && PRODUCTS[doctor.product]) return PRODUCTS[doctor.product];

    try {
      /* ?product= is for demonstrating all three from one local server. It
         wins over the remembered one so switching actually switches. */
      const asked = new URLSearchParams(location.search).get('product');
      if (asked && PRODUCTS[asked]) {
        localStorage.setItem(REMEMBERED, asked);
        return PRODUCTS[asked];
      }
      /* Whatever the last signed-in doctor was, so every screen after
         sign-in already wears her product without waiting for a round trip
         to /me. Cleared on sign-out. */
      const saved = localStorage.getItem(REMEMBERED);
      if (saved && PRODUCTS[saved]) return PRODUCTS[saved];
    } catch (_) { /* private window, or storage blocked - fall through */ }

    /* Nobody signed in and nothing asked for: the front door, not Ayurveda. */
    return PLATFORM;
  }

  /* Called once, right after sign-in, with the product from GET /me. From
     then on every screen this browser opens is branded as hers. */
  function remember(productId) {
    if (!PRODUCTS[productId]) return PLATFORM;
    try { localStorage.setItem(REMEMBERED, productId); } catch (_) {}
    window.TCOSProduct = PRODUCTS[productId];
    return PRODUCTS[productId];
  }

  /* On sign-out, so the next person at the same screen - a different doctor
     on a shared clinic computer - is not shown the last one's product. */
  function forget() {
    try { localStorage.removeItem(REMEMBERED); } catch (_) {}
    window.TCOSProduct = PLATFORM;
  }

  function label(product, key, fallback) {
    return (product && product.labels && product.labels[key]) || fallback;
  }

  window.TCOSProducts = {
    all: PRODUCTS,
    PLATFORM,
    list: () => Object.values(PRODUCTS),
    ids: () => Object.keys(PRODUCTS),
    resolve,
    remember,
    forget,
    label,
    DEFAULT_PRODUCT
  };

  /* Resolved once per page from whatever is known before sign-in. Screens
     that later learn who the doctor is call resolve() again with her row. */
  window.TCOSProduct = resolve(null);
})();
