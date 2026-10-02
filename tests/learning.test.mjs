import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLesson, parseLesson, encodeLesson, decodeLesson, revisionOf, moveStop,
  nextRequired, readWork, journalMarkdown, sourceURL, wikiURL, sampleLesson, LIMITS } from '../learning/model.mjs';

test('portable lessons preserve Unicode and strip private data at every boundary', () => {
  const lesson = sampleLesson();
  lesson.title = 'Mémoire · 科学 🔭';
  lesson.responses = { name: 'Private learner name', answer: 'Private thinking' };
  lesson.stops[0].answer = 'Private answer';
  const decoded = decodeLesson(encodeLesson(lesson));
  assert.equal(decoded.title, lesson.title);
  assert.equal(decoded.responses, undefined);
  assert.equal(decoded.stops[0].answer, undefined);
  assert.ok(!JSON.stringify(decoded).includes('Private'));
});

test('source links reject executable URLs, insecure links and embedded credentials', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<h1>Hi</h1>', 'http://example.com', '//example.com', 'https://name:secret@example.com']) {
    assert.throws(() => sourceURL(url));
  }
  assert.equal(sourceURL('https://example.com/paper?q=1#p2'), 'https://example.com/paper?q=1#p2');
  assert.equal(sourceURL(''), '');
});

test('malformed, oversized and unsupported lessons cannot be imported', () => {
  assert.throws(() => parseLesson('{'));
  assert.throws(() => parseLesson('x'.repeat(LIMITS.bytes + 1)));
  for (const change of [{ version: 2 }, { stops: [] }, { title: '' }, { id: '__proto__' }, { objective: null }]) {
    assert.throws(() => validateLesson({ ...sampleLesson(), ...change }));
  }
  const lesson = sampleLesson(); lesson.stops[1].id = lesson.stops[0].id;
  assert.throws(() => validateLesson(lesson), /unique/);
});

test('incomplete editing drafts can be recovered but cannot be shared', () => {
  const lesson = sampleLesson(); lesson.stops[0].topic = ''; lesson.stops[0].source = 'https:';
  assert.doesNotThrow(() => parseLesson(JSON.stringify(lesson), { draft: true }));
  assert.throws(() => encodeLesson(lesson));
});

test('links enforce a length limit and reject broken base64/UTF-8', () => {
  assert.throws(() => decodeLesson('a'.repeat(LIMITS.share + 1)));
  for (const invalid of ['', 'abc%20', 'a', '_w']) assert.throws(() => decodeLesson(invalid));
  const lesson = sampleLesson();
  lesson.stops = Array.from({ length: 12 }, (_, i) => ({ ...lesson.stops[0], id: `stop-${i}`, prompt: 'x'.repeat(1500) }));
  assert.doesNotThrow(() => validateLesson(lesson));
  assert.throws(() => encodeLesson(lesson), /Export/);
});

test('reordering preserves stop IDs and checkpoint text without mutating the original', () => {
  const lesson = sampleLesson();
  const reordered = moveStop(lesson, lesson.stops[1].id, -1);
  assert.equal(reordered.stops[0].id, lesson.stops[1].id);
  assert.equal(reordered.stops[0].prompt, lesson.stops[1].prompt);
  assert.notEqual(reordered.stops[0].id, lesson.stops[0].id);
  assert.equal(moveStop(lesson, lesson.stops[0].id, -1), lesson);
});

test('forward navigation cannot skip a blank required checkpoint; optional stops do not block', () => {
  const lesson = sampleLesson();
  const responses = { [lesson.stops[0].id]: { answer: '   ' } };
  assert.equal(nextRequired(lesson, responses, 3), 0);
  responses[lesson.stops[0].id].answer = 'My own reasoning';
  lesson.stops[1].required = false;
  assert.equal(nextRequired(lesson, responses, 2), -1);
  assert.equal(nextRequired(lesson, responses), 2);
});

test('lesson revisions isolate responses when title, prompt, ordering or source changes', async () => {
  const lesson = sampleLesson();
  const original = await revisionOf(lesson);
  assert.equal(await revisionOf(decodeLesson(encodeLesson(lesson))), original);
  for (const modify of [l => { l.title += ' updated'; }, l => { l.stops[0].prompt += '?'; },
    l => { l.stops.reverse(); }, l => { l.stops[0].source = 'https://example.com/paper'; }]) {
    const changed = structuredClone(lesson); modify(changed);
    assert.notEqual(await revisionOf(changed), original);
  }
  assert.throws(() => readWork(JSON.stringify({ revision: 'old', responses: {} }), original, lesson));
});

test('saved work keeps only valid answers and evidence for this lesson', () => {
  const lesson = sampleLesson(), stopId = lesson.stops[0].id;
  const input = JSON.stringify({ revision: 'same', responses: { [stopId]: { answer: 'My view', evidence: 'Page 2', extra: 'discard' }, outsider: { answer: 'discard' } } });
  assert.deepEqual(readWork(input, 'same', lesson), { [stopId]: { answer: 'My view', evidence: 'Page 2' } });
  assert.throws(() => readWork(JSON.stringify({ revision: 'same', responses: { [stopId]: { answer: 'x'.repeat(8001), evidence: '' } } }), 'same', lesson));
});

test('journal export separates thinking from evidence and renders user HTML/link syntax literally', () => {
  const lesson = sampleLesson();
  const markdown = journalMarkdown(lesson, { [lesson.stops[0].id]: { answer: '<script>alert(1)</script>', evidence: '[click](javascript:alert(1))' } });
  assert.match(markdown, /### My thinking/);
  assert.match(markdown, /### Source passage/);
  assert.ok(!markdown.includes('<script>'));
  assert.ok(!markdown.includes('[click](javascript:'));
  assert.equal(wikiURL('A/B? x#y'), 'https://en.wikipedia.org/wiki/A%2FB%3F_x%23y');
});
