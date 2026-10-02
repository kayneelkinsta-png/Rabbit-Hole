// Versioned, portable lesson plans. Responses are deliberately a separate object.
export const LIMITS = Object.freeze({ stops: 12, bytes: 98304, share: 12000, response: 8000 });
const encoder = new TextEncoder();
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function text(value, label, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new Error(`${label} ${required ? 'is required and ' : ''}must be at most ${max} characters.`);
  }
  return value.trim();
}

function id(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) throw new Error('This lesson has an invalid identifier.');
  return value;
}

export function sourceURL(value) {
  const input = text(value, 'Source URL', 2000, false);
  if (!input) return '';
  let url;
  try { url = new URL(input); } catch { throw new Error('Use a complete https:// source URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Source links must use HTTPS without a username or password.');
  return url.href;
}

export function validateLesson(value, { draft = false } = {}) {
  if (!object(value) || value.version !== 1) throw new Error('This is not a supported Rabbit Hole lesson (version 1).');
  if (!Array.isArray(value.stops) || !value.stops.length || value.stops.length > LIMITS.stops) {
    throw new Error(`A route needs between 1 and ${LIMITS.stops} stops.`);
  }
  const ids = new Set();
  const stops = value.stops.map((stop, index) => {
    if (!object(stop)) throw new Error(`Stop ${index + 1} is invalid.`);
    const stopId = id(stop.id);
    if (ids.has(stopId)) throw new Error('Each stop needs a unique identifier.');
    ids.add(stopId);
    if (typeof stop.required !== 'boolean') throw new Error('Each checkpoint needs a required setting.');
    return {
      id: stopId,
      topic: text(stop.topic, `Topic at stop ${index + 1}`, 160, !draft),
      prompt: text(stop.prompt, `Checkpoint at stop ${index + 1}`, 1500, !draft),
      source: draft ? text(stop.source, 'Source URL', 2000, false) : sourceURL(stop.source),
      required: stop.required,
    };
  });
  // Construct an allowlisted object: answers, names and other private fields never travel in a lesson.
  const lesson = { version: 1, id: id(value.id), title: text(value.title, 'Lesson title', 160, !draft),
    objective: text(value.objective, 'Learning objective', 1200, !draft), stops };
  if (encoder.encode(JSON.stringify(lesson)).length > LIMITS.bytes) throw new Error('This lesson is too large. Shorten the prompts or source URLs.');
  return lesson;
}

export function parseLesson(input, options) {
  if (typeof input !== 'string' || encoder.encode(input).length > LIMITS.bytes) throw new Error('This lesson file is too large.');
  let value;
  try { value = JSON.parse(input); } catch { throw new Error('This lesson file is not valid JSON.'); }
  return validateLesson(value, options);
}

export function encodeLesson(lesson) {
  const bytes = encoder.encode(JSON.stringify(validateLesson(lesson)));
  const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (encoded.length > LIMITS.share) throw new Error('This route is too long for a reliable link. Export its lesson file instead.');
  return encoded;
}

export function decodeLesson(encoded) {
  if (typeof encoded !== 'string' || !encoded.length || encoded.length > LIMITS.share || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new Error('This lesson link is incomplete or too long. Ask for the exported lesson file.');
  }
  try {
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    return parseLesson(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error(`Cannot open this lesson link. ${error.message}`);
  }
}

export async function revisionOf(lesson) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(validateLesson(lesson))));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function moveStop(lesson, stopId, direction) {
  const index = lesson.stops.findIndex(stop => stop.id === stopId);
  const target = index + direction;
  if (index < 0 || ![-1, 1].includes(direction) || target < 0 || target >= lesson.stops.length) return lesson;
  const stops = [...lesson.stops];
  [stops[index], stops[target]] = [stops[target], stops[index]];
  return { ...lesson, stops };
}

export function checkpointDone(stop, responses) {
  return typeof responses[stop.id]?.answer === 'string' && !!responses[stop.id].answer.trim();
}

export function nextRequired(lesson, responses, before = lesson.stops.length) {
  return lesson.stops.findIndex((stop, index) => index < before && stop.required && !checkpointDone(stop, responses));
}

export function readWork(input, revision, lesson) {
  const value = JSON.parse(input);
  if (!object(value) || value.revision !== revision || !object(value.responses)) throw new Error('Saved responses belong to a different lesson version.');
  const responses = {};
  for (const stop of lesson.stops) {
    const response = value.responses[stop.id];
    if (response !== undefined) {
      if (!object(response) || typeof response.answer !== 'string' || typeof response.evidence !== 'string' ||
          response.answer.length > LIMITS.response || response.evidence.length > LIMITS.response) throw new Error('Saved responses could not be read safely.');
      responses[stop.id] = { answer: response.answer, evidence: response.evidence };
    }
  }
  return responses;
}

export function journalMarkdown(lesson, responses) {
  // Keep user text literal when opened in a Markdown viewer (including raw HTML and links).
  const literal = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}\[\]()#+.!|~-])/g, '\\$1');
  const lines = [`# ${literal(lesson.title)}`, '', literal(lesson.objective), '', 'Rabbit Hole learning journal · exported by the learner', ''];
  for (const [index, stop] of lesson.stops.entries()) {
    const response = responses[stop.id] || {};
    lines.push(`## ${index + 1}. ${literal(stop.topic)}`, '', `Checkpoint: ${literal(stop.prompt)}`, '',
      '### My thinking', '', literal(response.answer || '(No response recorded)'), '',
      '### Source passage / page / timestamp', '', literal(response.evidence || '(No evidence note recorded)'), '',
      `Assigned source: ${literal(stop.source || wikiURL(stop.topic))}`, '');
  }
  return lines.join('\n');
}

export const wikiURL = topic => `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/ /g, '_'))}`;
export const newId = () => crypto.randomUUID();

export function sampleLesson() {
  return { version: 1, id: newId(), title: 'Can we trust a scientific claim?',
    objective: 'Compare kinds of evidence, question a claim, and explain what would change your mind.',
    stops: [
      { id: newId(), topic: 'Scientific method', prompt: 'Before reading: what makes a scientific claim trustworthy? Write your starting view, then one question you want to investigate.', source: '', required: true },
      { id: newId(), topic: 'Observational study', prompt: 'Imagine a headline claiming that a habit improves learning. If the evidence is observational, what else would you want to know? Point to a relevant passage.', source: '', required: true },
      { id: newId(), topic: 'Randomized controlled trial', prompt: 'How could a randomised study investigate the same claim? Compare one strength and one limitation with an observational study.', source: '', required: true },
      { id: newId(), topic: 'Correlation does not imply causation', prompt: 'Return to your starting view. What would you now check before trusting that headline? Cite evidence and say what remains uncertain.', source: '', required: true },
    ] };
}
