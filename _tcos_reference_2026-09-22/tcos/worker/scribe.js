/* =========================================================================
   The scribe: a consultation listened to, and a note drafted from it.

   Two calls to OpenAI. The first turns audio into words. The second turns
   words into the sections a doctor writes anyway - complaints, history,
   examination, advice, follow-up.

   WHAT THIS DELIBERATELY DOES NOT DO
   ----------------------------------
   It does not diagnose, does not suggest a medicine, does not decide a
   dose, and does not put a single character into the patient's record.
   It writes a draft that a clinician corrects and confirms, exactly like
   the lab-report reader. A note nobody checked is worse than no note,
   because it looks like it was checked.

   LANGUAGE
   --------
   An Indian consultation is rarely in one language. A patient says
   "do din se bukhar hai" and the doctor answers half in English. So:

     - the transcript keeps what was ACTUALLY SAID, in whatever mix it was
       said in. Translating before the doctor has read it throws away the
       patient's own words, which are sometimes the whole diagnosis;
     - the NOTE is written in English, because that is what goes on a
       prescription and what another doctor will read - but a patient's own
       phrasing is quoted where it carries meaning that a paraphrase loses.

   WHAT IT REFUSES TO INVENT
   -------------------------
   If a section was not discussed, it stays empty. An examination that did
   not happen must not appear in a record because the shape of a note
   suggested there should be one - that is how a model turns silence into
   a false clinical finding. The schema below makes empty the easy answer.
   ========================================================================= */

import { ApiError, badRequest } from '@tharigopula/core/lib';

const OPENAI = 'https://api.openai.com/v1';

/* Cheap and multilingual. Transcription is priced per minute of audio, not
   per token, so the token rate table in ai.js does not apply here. */
const TRANSCRIBE_MODEL = 'gpt-4o-transcribe';
const NOTE_MODEL = 'gpt-5.4-mini';

/* Rupees per minute of audio, and per consultation for the note. Kept here
   next to the models they price, because the last time a rate lived far
   from its model it was silently wrong for four days. */
const PAISE_PER_MINUTE = 60;

export function configured(env) {
  return !!env.OPENAI_API_KEY;
}

/* ---------------------------------------------------------- transcribe --- */

/* Audio in, words out. `language` is a hint, never a filter: passing 'hi'
   must not stop the model hearing the English half of the sentence. */
export async function transcribe(env, { bytes, filename, languageHint }) {
  if (!configured(env)) {
    throw new ApiError(503, 'no_ai_provider',
      'Automatic note-taking is not switched on yet. Set the OPENAI_API_KEY secret.');
  }

  const form = new FormData();
  form.append('file', new Blob([bytes]), filename || 'consultation.webm');
  form.append('model', TRANSCRIBE_MODEL);
  /* Ask for the spoken words, not a tidied translation. */
  form.append('response_format', 'json');
  if (languageHint) form.append('language', languageHint);
  /* Steers spelling of things a general model mishears: drug names, and the
     Indian-English registers a clinic actually speaks in. */
  form.append('prompt',
    'A medical consultation in an Indian clinic. The speakers may mix ' +
    'English with Hindi, Telugu, Tamil, Marathi, Bengali or Kannada in the ' +
    'same sentence. Transcribe what is said, in the language it is said in. ' +
    'Medicine names are usually English or Sanskrit.');

  const response = await fetch(OPENAI + '/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY },
    body: form
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApiError(502, 'transcribe_failed',
      'The recording could not be transcribed. ' + detail.slice(0, 160));
  }

  const payload = await response.json();
  const text = String(payload.text || '').trim();
  if (!text) {
    throw new ApiError(422, 'nothing_heard',
      'Nothing could be heard in that recording. Check the microphone and try again.');
  }
  return { text, language: payload.language || null };
}

/* --------------------------------------------------------- the note --- */

/* Every field may be empty, and the description of each says so. This is
   the part that stops a model filling a plausible-looking examination into
   a consultation where none happened. */
/* WHO SAID WHAT, AND WHY NOT BY VOICE
   -----------------------------------
   The obvious idea is to record the doctor once and match her voice
   afterwards. It is the wrong tool here, for two reasons.

   The transcription model returns words, not speakers - it has no voice
   print to compare against - so this would mean a second service, an
   enrolment step, and a stored biometric of the doctor, which is a heavier
   thing to hold than the audio we are careful to delete.

   And it breaks on exactly the day it is needed. A doctor with a cold, on
   a different phone, or across a noisy room does not match her enrolment,
   and the system confidently labels her as the patient.

   Content is the stronger signal and needs no enrolment: in every
   consultation one person asks the questions, names the medicines and gives
   the instructions, and the other describes what is wrong with them. That
   holds whoever is speaking, in whatever language, with or without a cold.
   So the model is asked to attribute by role, and the note records which
   attribution it made so a doctor can see when it got confused. */
const NOTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['complaints', 'history', 'examination', 'advice', 'followUp',
             'speakers', 'confidence'],
  properties: {
    speakers: { type: 'string', description:
      'One line naming how many people spoke and which was the clinician, ' +
      'e.g. "Two speakers; the clinician asked the questions and named the ' +
      'medicines." If it could not be told apart, say so plainly.' },
    confidence: { type: 'string', enum: ['clear', 'mixed', 'unclear'],
      description:
        'clear = who was speaking was obvious throughout. mixed = mostly ' +
        'clear with passages that were not. unclear = the roles could not be ' +
        'reliably separated, so the doctor must read the transcript herself.' },
    complaints: { type: 'string', description:
      'What the patient came in saying, in their own terms. Empty string if not discussed.' },
    history: { type: 'string', description:
      'Relevant past illness, medication, allergy or family history MENTIONED IN THIS CONVERSATION. Empty string if none was mentioned.' },
    examination: { type: 'string', description:
      'Findings the doctor stated aloud, and vital signs she read out. Empty string if no examination was described. Never infer an examination from the complaint.' },
    advice: { type: 'string', description:
      'What the doctor told the patient to do. Do not add advice she did not give.' },
    followUp: { type: 'string', description:
      'When she asked the patient to return, if she said. Empty string otherwise.' }
  }
};

const SYSTEM = [
  'You write clinical notes from a transcript of a consultation in an Indian clinic.',
  '',
  'You are a scribe, not a clinician. Write ONLY what was said.',
  '',
  'Rules, in order of importance:',
  '1. Never add a symptom, finding, diagnosis, medicine or dose that is not in the transcript.',
  '2. If a section was not discussed, return an empty string for it. An empty',
  '   section is correct and expected. Do not fill it to look complete.',
  '3. Do not diagnose. If the doctor named a diagnosis, record that she named it.',
  '4. Write in English, because the note is read by other clinicians. Where the',
  '   patient\'s own words carry meaning a paraphrase would lose, quote them and',
  '   put the English in brackets after.',
  '5. Keep it short. A note is read in ten seconds by someone busy.',
  '6. If the transcript is too unclear to write a section honestly, leave it empty',
  '   rather than guessing. The doctor will fill it in.',
  '',
  'TELLING THE SPEAKERS APART',
  'The transcript is not labelled by speaker. Work out the roles from what is',
  'said, not from how it sounds:',
  '  - the CLINICIAN asks the questions, names medicines and doses, explains,',
  '    and says when to come back;',
  '  - the PATIENT (or whoever came with them) describes what is wrong, how',
  '    long it has been going on, and answers.',
  'Put the patient\'s account in complaints and history. Put the clinician\'s',
  'words in examination, advice and followUp. Never attribute advice to the',
  'patient or a symptom to the clinician.',
  '',
  'If two people both describe symptoms - a parent speaking for a child, or a',
  'relative adding detail - that is still the patient side. Say so in speakers.',
  '',
  'If you genuinely cannot tell who was who, set confidence to "unclear" and',
  'leave the sections you are unsure about empty. A note attributed to the',
  'wrong person is worse than a note that admits it could not tell.'
].join('\n');

export async function draftNote(env, transcript) {
  if (!configured(env)) {
    throw new ApiError(503, 'no_ai_provider', 'Automatic note-taking is not switched on yet.');
  }
  if (!String(transcript || '').trim()) throw badRequest('There is nothing to write a note from.');

  const response = await fetch(OPENAI + '/responses', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.OPENAI_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: NOTE_MODEL,
      /* Avoid persisted Responses application state. Standard provider
         abuse-monitoring logs may still retain request content temporarily;
         the privacy notice must say that plainly. */
      store: false,
      input: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: 'Transcript of the consultation:\n\n' + transcript }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'consultation_note',
          strict: true,
          schema: NOTE_SCHEMA
        }
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApiError(502, 'note_failed',
      'The note could not be written. ' + detail.slice(0, 160));
  }

  const payload = await response.json();
  const text = payload.output_text ||
    (payload.output || []).flatMap(o => (o.content || []).map(c => c.text)).join('');

  let note;
  try { note = JSON.parse(text); }
  catch {
    throw new ApiError(502, 'note_unreadable', 'The note came back in a shape we could not read.');
  }

  return {
    complaints: String(note.complaints || '').trim(),
    history: String(note.history || '').trim(),
    examination: String(note.examination || '').trim(),
    advice: String(note.advice || '').trim(),
    followUp: String(note.followUp || '').trim(),
    speakers: String(note.speakers || '').trim(),
    /* Anything the model did not answer is treated as "could not tell",
       never as "clear" - the safe default is the one that makes the doctor
       read the transcript. */
    confidence: ['clear', 'mixed', 'unclear'].includes(note.confidence)
      ? note.confidence : 'unclear',
    usage: payload.usage || null
  };
}

/* ------------------------------------------------------------- costing --- */

/* Rounded UP to the minute, the way the provider bills, so the figure the
   doctor sees is never lower than the figure we pay. */
export function costPaise(seconds) {
  const minutes = Math.max(1, Math.ceil((Number(seconds) || 0) / 60));
  return minutes * PAISE_PER_MINUTE;
}

/* Long enough to be a consultation, short enough not to be an accident.
   A recording left running for an hour is a bill and a privacy problem, so
   it is refused rather than silently truncated. */
export const MAX_SECONDS = 45 * 60;

export function checkLength(seconds) {
  const n = Number(seconds) || 0;
  if (n <= 0) return 'That recording is empty.';
  if (n > MAX_SECONDS) {
    return 'That recording is longer than 45 minutes. Record consultations one at a time.';
  }
  return null;
}
