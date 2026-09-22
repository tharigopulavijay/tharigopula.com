/* =========================================================================
   The AI scribe.

   Three things must hold, and none of them is "does it write a good note".

     1. A note the model wrote must not reach a patient's record until a
        clinician has confirmed it. A note nobody checked is worse than no
        note, because it looks like it was checked.
     2. The audio must be deleted. It is a patient's voice discussing their
        health; the only reason to hold it is the minute it takes to
        transcribe.
     3. The model must be free to say NOTHING. A consultation where no
        examination happened must produce an empty examination, not a
        plausible one. The shape of a form is not evidence.

   Run:  node test/scribe.test.js
   ========================================================================= */

import { costPaise, checkLength, MAX_SECONDS, configured, draftNote, transcribe }
  from '../worker/scribe.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};
const withFetch = fn => { globalThis.fetch = fn; };

/* ------------------------------------------------------------ costing --- */
console.log('\nWhat it costs, rounded the way we are billed\n');

check('a one-minute consultation costs a minute', costPaise(60) === 60, String(costPaise(60)));
/* Providers bill per started minute. Rounding down would show the doctor a
   number lower than the one we pay. */
check('61 seconds is two minutes, not one', costPaise(61) === 120, String(costPaise(61)));
check('a few seconds still costs the first minute', costPaise(5) === 60, String(costPaise(5)));
check('ten minutes is ₹6', costPaise(600) === 600, String(costPaise(600)));

/* ------------------------------------------------------------- length --- */
console.log('\nA recording left running is a bill and a privacy problem\n');

check('an empty recording is refused', /empty/.test(checkLength(0) || ''), checkLength(0));
check('a normal consultation is fine', checkLength(600) === null);
check('45 minutes is still allowed', checkLength(MAX_SECONDS) === null);
check('an hour is refused rather than silently truncated',
  /longer than 45 minutes/.test(checkLength(3600) || ''), checkLength(3600));

/* -------------------------------------------------------- switched off --- */
console.log('\nSwitched off is a state, not a crash\n');

check('no key is not configured', configured({}) === false);
check('a key is configured', configured({ OPENAI_API_KEY: 'k' }) === true);

let threw = null;
try { await transcribe({}, { bytes: new Uint8Array([1]) }); }
catch (error) { threw = error; }
check('transcribing without a key says which secret to set',
  threw && /OPENAI_API_KEY/.test(threw.message), threw && threw.message);

/* --------------------------------------------------- silence stays silent --- */
console.log('\nThe model may say nothing, and nothing must survive as nothing\n');

/* The whole risk of a scribe: a form with five boxes invites five answers.
   An examination that did not happen must come back empty. */
withFetch(async () => ({
  ok: true,
  json: async () => ({
    output_text: JSON.stringify({
      complaints: 'Fever for two days, body ache.',
      history: '',
      examination: '',
      advice: 'Paracetamol if the fever rises. Return if it lasts past Thursday.',
      followUp: 'Thursday'
    })
  })
}));
let note = await draftNote({ OPENAI_API_KEY: 'k' }, 'do din se bukhar hai...');
check('an empty examination stays empty', note.examination === '', JSON.stringify(note.examination));
check('an empty history stays empty', note.history === '');
check('what WAS said is kept', /Fever for two days/.test(note.complaints));
check('and the follow-up is kept', note.followUp === 'Thursday');

/* Nulls and missing keys must not become the string "null" in a record. */
withFetch(async () => ({
  ok: true,
  json: async () => ({ output_text: JSON.stringify({ complaints: 'Cough.' }) })
}));
note = await draftNote({ OPENAI_API_KEY: 'k' }, 'khaansi');
check('a missing section becomes an empty string, never "undefined"',
  note.examination === '' && note.advice === '' && note.followUp === '',
  JSON.stringify(note));

/* ------------------------------------------------------- failing loudly --- */
console.log('\nWhen it cannot, it says so\n');

withFetch(async () => ({ ok: false, text: async () => 'model overloaded' }));
threw = null;
try { await draftNote({ OPENAI_API_KEY: 'k' }, 'something was said'); }
catch (error) { threw = error; }
check('a refused note throws rather than returning an empty one', threw !== null);
check('and repeats what the provider said',
  threw && /model overloaded/.test(threw.message), threw && threw.message);

withFetch(async () => ({ ok: true, json: async () => ({ output_text: 'not json at all' }) }));
threw = null;
try { await draftNote({ OPENAI_API_KEY: 'k' }, 'something'); }
catch (error) { threw = error; }
check('an unreadable answer is an error, not a blank note',
  threw && /shape we could not read/.test(threw.message), threw && threw.message);

threw = null;
try { await draftNote({ OPENAI_API_KEY: 'k' }, '   '); }
catch (error) { threw = error; }
check('an empty transcript never reaches the model',
  threw && /nothing to write a note from/.test(threw.message), threw && threw.message);

/* A recording with no speech in it must not become a note full of empties
   that the doctor then has to notice is meaningless. */
withFetch(async () => ({ ok: true, json: async () => ({ text: '   ' }) }));
threw = null;
try { await transcribe({ OPENAI_API_KEY: 'k' }, { bytes: new Uint8Array([1]) }); }
catch (error) { threw = error; }
check('a silent recording is refused, not turned into an empty note',
  threw && /Nothing could be heard/.test(threw.message), threw && threw.message);

/* ------------------------------------------------------ who was talking --- */
console.log('\nWho was speaking, worked out from what was said\n');

withFetch(async () => ({
  ok: true,
  json: async () => ({
    output_text: JSON.stringify({
      complaints: 'Fever for two days.', history: '', examination: '',
      advice: 'Paracetamol if it rises.', followUp: '',
      speakers: 'Two speakers; the clinician asked the questions.',
      confidence: 'clear'
    })
  })
}));
note = await draftNote({ OPENAI_API_KEY: 'k' }, 'transcript');
check('it reports how it told them apart', /clinician asked/.test(note.speakers), note.speakers);
check('and how sure it was', note.confidence === 'clear', note.confidence);

/* The important default. A model that omits the field, or invents a value,
   must NOT be read as "confident" - a complaint recorded as advice is a
   wrong entry in a medical record, and the safe default is the one that
   makes the doctor read the transcript herself. */
withFetch(async () => ({
  ok: true,
  json: async () => ({ output_text: JSON.stringify({ complaints: 'Cough.' }) })
}));
note = await draftNote({ OPENAI_API_KEY: 'k' }, 'transcript');
check('a missing confidence is treated as UNCLEAR, never as clear',
  note.confidence === 'unclear', note.confidence);

withFetch(async () => ({
  ok: true,
  json: async () => ({
    output_text: JSON.stringify({ complaints: 'x', confidence: 'very sure indeed' })
  })
}));
note = await draftNote({ OPENAI_API_KEY: 'k' }, 'transcript');
check('an invented confidence value is refused, not trusted',
  note.confidence === 'unclear', note.confidence);

/* ---------------------------------------------------------- the prompt --- */
console.log('\nWhat we ask the model to be\n');

const src = await (await import('node:fs/promises')).readFile('worker/scribe.js', 'utf8');
check('it is told it is a scribe, not a clinician', /scribe, not a clinician/.test(src));
check('it is forbidden from adding a medicine or dose',
  /Never add a symptom, finding, diagnosis, medicine or dose/.test(src));
/* The instruction wraps across lines in the source, so the check has to
   allow for it - matching a single line would pass today and fail the next
   time somebody reflows the comment. */
check('an empty section is stated to be correct and expected',
  /empty[\s\S]{0,20}section is correct and expected/i.test(src));
check('it is told not to diagnose', /Do not diagnose/.test(src));
check('persisted Responses application state is disabled', /store: false/.test(src));
check('the transcript keeps the language actually spoken',
  /in the language it is said in/.test(src));

/* Roles are decided by CONTENT, not by matching a stored voice. A voice
   print needs an enrolment step, a second service and a biometric of the
   doctor on file - and it fails on the day she has a cold, which is
   precisely when a wrong attribution would go unnoticed. */
check('the clinician is identified by asking questions and naming medicines',
  /CLINICIAN asks the questions, names medicines/.test(src));
check('the patient side is whoever describes the problem',
  /PATIENT[\s\S]{0,80}describes what is wrong/.test(src));
check('a parent speaking for a child still counts as the patient side',
  /parent speaking for a child/.test(src));
check('advice is never attributed to the patient',
  /Never attribute advice to the/.test(src));
check('and when it cannot tell, it must say so rather than guess',
  /wrong person is worse than a note that admits/.test(src));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
