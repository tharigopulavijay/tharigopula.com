/* =========================================================================
   A fake browser for the consultation desk.

   Shared by test/desk-boot.test.js and test/desk-without-scratchpad.test.js
   rather than copied into each. Two copies of a harness drift, and the day
   they drift is the day one suite is quietly testing a page the other one
   is not.

   It is deliberately not jsdom. The desk needs six DOM methods and a
   selector shape; a dependency to provide them would be the seventh runtime
   dependency in a repo that has one, and it would still not run the real
   thing - only a browser does that.

   Not a suite itself: the filename has no `.test.js`, so the runner's
   directory check does not expect it to be one.
   ========================================================================= */

import { readFileSync } from 'node:fs';

/* --------------------------------------------------------- an element --- */

export function fakeElement(id) {
  /* Children found by selector are CACHED per element, so the node the desk
     attached a click handler to is the same node the assertions later click.
     Handing back a fresh object each time is how the first version of this
     silently tested nothing: the desk wired its own copies, the test clicked
     different copies, and nothing happened while everything reported fine.
     The cache is dropped whenever innerHTML is rewritten, because at that
     point those nodes are genuinely gone. */
  let html = '';
  let found = new Map();

  const node = {
    id, textContent: '', value: '', hidden: false, disabled: false,
    className: '', dataset: {}, style: {}, title: '',
    children: [], listeners: {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    removeEventListener() {},

    /* Enough of a selector engine to answer the one shape the desk asks
       for: [data-something]. It reads the HTML that was actually written
       into this element and hands back a node per match, carrying the
       attribute value in dataset.

       Without this every querySelectorAll returned [], so nothing the desk
       renders was ever wired and the tests could only assert that strings
       had been produced. With it, a button in the queue can be CLICKED and
       what happens next can be looked at - which is the difference between
       testing the page and testing the template. */
    querySelectorAll(selector) {
      const match = /^\[data-([a-z-]+)\]$/.exec(String(selector || ''));
      if (!match) return [];
      const key = match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const pattern = new RegExp('data-' + match[1] + '="([^"]*)"', 'g');
      const list = [];
      let hit;
      while ((hit = pattern.exec(html)) !== null) {
        const at = 'data-' + match[1] + ':' + hit[1];
        if (!found.has(at)) {
          const child = fakeElement(at);
          child.dataset[key] = hit[1];
          found.set(at, child);
        }
        list.push(found.get(at));
      }
      return list;
    },
    querySelector() { return null; },
    appendChild(child) { this.children.push(child); return child; },
    replaceWith() {},
    reset() {},
    showModal() { this.open = true; },
    close() { this.open = false; },
    select() {},
    focus() {},
    scrollIntoView() {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false }
  };

  Object.defineProperty(node, 'innerHTML', {
    get() { return html; },
    set(value) { html = String(value == null ? '' : value); found = new Map(); },
    enumerable: true
  });

  return node;
}

/* ----------------------------------------------------------- the page --- */

export function makeDom() {
  const elements = new Map();
  return {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, fakeElement(id));
      return elements.get(id);
    },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    createElement: () => fakeElement('created'),
    body: fakeElement('body'),
    addEventListener() {}
  };
}

/* ------------------------------------------------------------ the API --- */

/* The consultation she started yesterday and did not save. Kept here so
   both suites restore the SAME sheet - one asserting it comes back, the
   other asserting the desk copes when it cannot. */
export const KEPT_DRAFT = {
  patientId: 'pat_1',
  updatedAt: '2026-09-10T09:15:00.000Z',
  expiresAt: '2026-09-11T09:15:00.000Z',
  payload: {
    v: 1,
    doc: {
      complaints: 'Burning in the chest after meals',
      diagnosis: 'Amlapitta', examination: '', advice: '', followUp: '',
      vitals: { bloodPressure: '124/80', weight: '71' },
      items: [{ name: 'Avipattikar churna', dose: '3g', frequency: 'Twice a day' }]
    },
    plan: { avoid: ['Chillies'] },
    alerts: 'Penicillin'
  }
};

/* `overrides` replaces individual methods, so a suite can make exactly the
   calls it cares about fail while everything else answers normally. */
export function makeApi(overrides = {}) {
  /* What the desk asked the server to do, in order. Assertions can then look
     at what a click actually SENT rather than at what the screen says it did -
     which is the only way to catch a value that is on the sheet and quietly
     left out of the save. */
  const calls = [];
  const sent = name => calls.filter(entry => entry[0] === name).map(entry => entry[1]);

  const api = {
    isSignedIn: () => true,
    me: async () => ({
      fullName: 'Dr Example', clinicName: 'Example Clinic',
      qualification: 'MD', registrationNo: 'REG-1', address: 'Somewhere',
      mobile: '+919000000000'
    }),
    listPatients: async () => ({ patients: [
      { id: 'pat_1', full_name: 'A Patient', mobile: '+919111111111',
        sex: 'Female', local_ref: 'TCOS-1001', allergies: null }
    ] }),
    appointments: async () => ({ appointments: [
      { patient_id: 'pat_1', status: 'arrived', scheduled_at: '10:00' }
    ] }),
    prescriptionList: async () => ({ prescriptions: [] }),
    labSeries: async () => ({ series: [] }),
    getPrescription: async () => ({ prescription: {} }),
    createVisit: async visit => {
      calls.push(['createVisit', visit]); return { visit: { id: 'vis_1' } };
    },
    createPrescription: async rx => {
      calls.push(['createPrescription', rx]); return { prescription: { id: 'rx_1' } };
    },
    savePrescriptionItems: async (id, items) => {
      calls.push(['savePrescriptionItems', items]); return {};
    },
    issuePrescription: async () => ({ prescription: { rx_number: 'RX-1' } }),
    carePlan: async () => ({ plan: null, previous: null }),
    saveCarePlan: async (visitId, plan) => { calls.push(['saveCarePlan', plan]); return {}; },
    setAllergies: async (patientId, allergies) => {
      calls.push(['setAllergies', allergies]); return {};
    },
    addPatient: async () => ({ patient: { id: 'pat_2' } }),
    createUploadLink: async () => ({
      url: 'https://tcos.pages.dev/u.html#abc', expiresInMinutes: 30
    }),
    listRequests: async () => ({ requests: [
      { id: 'req_1', full_name: 'A Walk-in', visit_type: 'first',
        age_years: 41, sex: 'Male', matched_patient_id: null }
    ] }),
    acceptRequest: async () => ({ patient: { id: 'pat_1' } }),
    publicPageSettings: async () => ({ slug: 'a-clinic' }),

    openConsultationDrafts: async () => ({ drafts: [
      { patientId: KEPT_DRAFT.patientId, updatedAt: KEPT_DRAFT.updatedAt,
        expiresAt: KEPT_DRAFT.expiresAt }
    ] }),
    consultationDraft: async () => ({ draft: KEPT_DRAFT }),
    saveConsultationDraft: async (patientId, payload) => {
      calls.push(['saveConsultationDraft', payload]); return { draft: {} };
    },
    clearConsultationDraft: async patientId => {
      calls.push(['clearConsultationDraft', patientId]); return { cleared: patientId };
    },

    ...overrides
  };

  return { api, calls, sent };
}

/* --------------------------------------------------------- running it --- */

/* Runs js/desk.js for real against the fakes above and returns whatever
   killed it, or null.

   The desk is an async IIFE, so a failure inside it does NOT come back from
   the call - it becomes a rejected promise nobody holds, which kills the
   process a moment later. The first assertions would print PASS and then
   node would die mid-file, which reads like the harness broke rather than
   like the page is dead. Catching it turns that into a plain FAIL that
   names the error. */
export async function runDesk(doc, api) {
  new Function('window', 'module',
    readFileSync('js/qr.js', 'utf8'))(globalThis.__win = {}, undefined);

  const win = {
    addEventListener() {}, print() {},
    location: { href: '', search: '' },
    TCOSQr: globalThis.__win.TCOSQr
  };
  new Function('window', readFileSync('js/rx-document.js', 'utf8'))(win);

  let boot = null;
  process.on('unhandledRejection', error => { boot = boot || error; });
  process.on('uncaughtException', error => { boot = boot || error; });

  try {
    /* The boot overlay is a real global on the page (js/app-boot.js loads
       before everything), so the harness has to supply one or the desk
       throws a ReferenceError the moment it checks the session - which is
       precisely what this suite exists to catch, and it did. The stub
       records rather than navigates, so a test can assert where the desk
       decided to send her. */
    const bootCalls = [];
    win.TCOSBoot = {
      ready: () => bootCalls.push('ready'),
      failed: message => bootCalls.push('failed:' + message),
      toSignIn: reason => { bootCalls.push('toSignIn:' + reason); win.location.href = 'tcos-login.html'; },
      bounced: () => false,
      clearBounce() {}
    };
    win.bootCalls = bootCalls;

    const run = new Function(
      'window', 'document', 'TCOSApi', 'location', 'localStorage', 'confirm', 'setTimeout',
      'TCOSBoot',
      readFileSync('js/desk.js', 'utf8'));
    /* The real setTimeout, not one that fires straight away. The desk
       schedules an autosave from every keystroke, and a setTimeout that runs
       its callback immediately turns a debounce into recursion - which would
       be the harness inventing a failure the page does not have. */
    run(win, doc, api, win.location,
      { getItem: () => null, setItem() {} }, () => true, setTimeout,
      win.TCOSBoot);
  } catch (error) { boot = error; }

  /* Let the IIFE settle so a rejection has happened, and so the queue has
     been painted, before anything is asserted about either. */
  await new Promise(resolve => setTimeout(resolve, 120));
  return { boot, win };
}

export const settle = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));

/* A tiny assertion recorder, so both suites report identically. */
export function reporter() {
  const state = { passed: 0, failed: 0 };
  const check = (name, ok, detail) => {
    if (ok) { state.passed++; console.log('  PASS  ' + name); }
    else { state.failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
  };
  const done = () => {
    console.log('\n' + state.passed + ' passed, ' + state.failed + ' failed\n');
    process.exit(state.failed ? 1 : 0);
  };
  return { check, done, state };
}
