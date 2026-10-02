import { LIMITS, validateLesson, parseLesson, encodeLesson, decodeLesson, revisionOf, moveStop,
  checkpointDone, nextRequired, readWork, journalMarkdown, wikiURL, newId, sampleLesson } from './model.mjs';

const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const warning = document.querySelector('#storage-warning');
const DRAFT_KEY = 'rh-learning-draft-v1';
let draft, selectedId, lesson, revision, responses = {}, position = 0, preview = false;
let activeView = 'teacher';

function element(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (['value', 'checked', 'disabled', 'hidden'].includes(key)) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
const button = (label, action, attributes = {}) => element('button', { type: 'button', onclick: action, ...attributes }, label);
const link = (label, href) => element('a', { class: 'button quiet', href, target: '_blank', rel: 'noopener noreferrer' }, label);
const paragraph = (text, className = '') => element('p', { class: className }, text);

function announce(message, error = false) {
  notice.textContent = message;
  notice.classList.toggle('warning', error);
  notice.hidden = false;
}
function storageWarning(message) { warning.textContent = message; warning.hidden = false; }
function clearNotice() { notice.hidden = true; notice.textContent = ''; }
function focusHeading() { app.querySelector('h1, h2')?.focus(); }
function getStored(key) {
  try { return localStorage.getItem(key); }
  catch { storageWarning('Device storage is unavailable. Keep this tab open and export your work before leaving.'); return null; }
}
function putStored(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { storageWarning('Your latest changes could not be saved on this device. Export your work before closing this tab.'); return false; }
}
function saveDraft() {
  let saved = false;
  try { saved = putStored(DRAFT_KEY, validateLesson(draft, { draft: true })); }
  catch (error) { announce(error.message, true); }
  const status = document.querySelector('#save-status');
  if (status) status.textContent = saved ? 'Draft saved on this device' : 'Not saved — export a backup';
}
function saveWork() {
  const saved = putStored(`rh-learning-work-v1:${revision}`, { revision, responses });
  const status = document.querySelector('#save-status');
  if (status) status.textContent = saved ? 'Journal saved on this device' : 'Not saved — export your journal';
}
function download(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = element('a', { href: url, download: filename });
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function exportLesson() {
  try {
    download(JSON.stringify(validateLesson(draft, { draft: true }), null, 2), 'application/json', 'rabbit-hole-lesson.json');
    announce('Draft exported without responses. Complete every topic and checkpoint, and check source URLs, before learners open this file.');
  } catch (error) { announce(error.message, true); }
}
function exportJournal() {
  download(journalMarkdown(lesson, responses), 'text/markdown;charset=utf-8', 'rabbit-hole-journal.md');
  announce('Journal exported. Share the file with your teacher when you are ready.');
}
function openFile(editing) {
  const input = element('input', { type: 'file', accept: '.json,application/json', class: 'file-input' });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > LIMITS.bytes) throw new Error('This lesson file is too large.');
      const imported = parseLesson(await file.text(), { draft: editing });
      if (editing) {
        if (!confirm('Replace the current draft on this device? Export it first if you want to keep it.')) return;
        draft = { ...imported, id: newId() }; selectedId = draft.stops[0].id;
        saveDraft(); clearNotice(); renderTeacher();
        announce('Lesson imported as your editable draft.');
      } else {
        await openStudent(imported, false);
        // An imported file replaces the active link, so refresh cannot open a different lesson.
        try { history.replaceState(null, '', `${location.pathname}#lesson=${encodeLesson(imported)}`); }
        catch { history.replaceState(null, '', location.pathname); announce('Lesson file opened. Keep the original file to reopen this route.'); }
      }
    } catch (error) { announce(error.message, true); }
    finally { input.remove(); }
  });
  // Attach for browser file-picker compatibility; remove on cancellation as well.
  input.addEventListener('cancel', () => input.remove());
  document.body.append(input); input.click();
}

function field(label, key, value, update, { rows, max = 160, help = '', type = 'text', className = '' } = {}) {
  const control = element(rows ? 'textarea' : 'input', {
    id: key, ...(rows ? { rows } : { type }), value, maxlength: max, class: className,
    ...(help ? { 'aria-describedby': `${key}-help` } : {}), oninput: event => update(event.target.value),
  });
  return element('div', { class: 'field' }, element('label', { for: key, class: 'field-label' }, label), control,
    help ? element('span', { id: `${key}-help`, class: 'helper' }, help) : null);
}

function routeList(currentLesson, index, select, student = false) {
  return element('ol', { class: 'route-list', 'aria-label': 'Lesson stops' }, currentLesson.stops.map((stop, i) => {
    const done = student && checkpointDone(stop, responses);
    return element('li', {}, button([
      element('span', { class: `stop-number${done ? ' done' : ''}`, 'aria-hidden': 'true' }, done ? '✓' : i + 1),
      element('span', {}, element('span', { class: 'stop-title', 'data-stop-title': stop.id }, stop.topic || 'Untitled stop'),
        element('span', { class: 'stop-meta' }, done ? 'Response recorded' : stop.required ? 'Required checkpoint' : 'Optional checkpoint')),
    ], () => select(i), { class: 'stop', ...(i === index ? { 'aria-current': 'step' } : {}) }));
  }));
}

function renderTeacher() {
  activeView = 'teacher';
  document.title = 'Plan a learning route · Rabbit Hole';
  const index = Math.max(0, draft.stops.findIndex(stop => stop.id === selectedId));
  const stop = draft.stops[index]; selectedId = stop.id;
  const update = key => value => {
    draft[key] = value; document.querySelector('#share-panel')?.remove(); saveDraft();
  };
  const updateStop = key => value => {
    stop[key] = value; document.querySelector('#share-panel')?.remove(); saveDraft();
    if (key === 'topic') for (const title of app.querySelectorAll('[data-stop-title]')) if (title.dataset.stopTitle === stop.id) title.textContent = value || 'Untitled stop';
  };
  const select = i => { selectedId = draft.stops[i].id; clearNotice(); renderTeacher(); document.querySelector('#topic').focus(); };
  const move = direction => { draft = moveStop(draft, selectedId, direction); saveDraft(); renderTeacher(); document.querySelector('#topic').focus(); };
  const intro = element('div', { class: 'intro' }, element('div', {}, element('span', { class: 'eyebrow' }, 'A little structure. A lot of curiosity.'),
    element('h1', { tabindex: '-1' }, 'Plan a learning route'), paragraph('Choose the places to explore. Add the moments to stop, question, and connect.', 'muted')),
    element('div', { class: 'actions' }, button('Try student view', async () => {
      try { const valid = validateLesson(draft); saveDraft(); await openStudent(valid, true); }
      catch (error) { announce(error.message, true); }
    }, { class: 'primary' }), button('Open lesson file', () => openFile(false), { class: 'quiet' })));
  const sidebar = element('aside', { class: 'panel sidebar', 'aria-label': 'Route editor' }, element('h2', {}, 'Your route'),
    paragraph(`${draft.stops.length} stops · reorder with the arrow buttons`, 'muted'), routeList(draft, index, select),
    button('+ Add a stop', () => {
      const added = { id: newId(), topic: '', prompt: '', source: '', required: true };
      draft.stops.push(added); selectedId = added.id; saveDraft(); renderTeacher(); document.querySelector('#topic').focus();
    }, { class: 'quiet', disabled: draft.stops.length >= LIMITS.stops }),
    paragraph('Drafts stay in this browser. Export a lesson file to keep a backup or move devices.', 'privacy'));
  const editor = element('section', { class: 'panel', 'aria-label': 'Lesson details' },
    field('Lesson title', 'lesson-title', draft.title, update('title')),
    field('What should learners leave understanding?', 'objective', draft.objective, update('objective'), { rows: 2, max: 1200 }),
    element('hr', { class: 'section-divider' }),
    element('div', { class: 'editor-heading' }, element('h2', {}, `Stop ${index + 1} of ${draft.stops.length}`),
      element('div', { class: 'actions compact' },
        button('↑ Earlier', () => move(-1), { disabled: index === 0, 'aria-label': 'Move stop earlier' }),
        button('↓ Later', () => move(1), { disabled: index === draft.stops.length - 1, 'aria-label': 'Move stop later' }),
        button('Remove', () => {
          if (!confirm('Remove this stop and its checkpoint from the draft?')) return;
          draft.stops.splice(index, 1); selectedId = draft.stops[Math.min(index, draft.stops.length - 1)].id;
          saveDraft(); renderTeacher(); document.querySelector('#topic').focus();
        }, { class: 'quiet danger', disabled: draft.stops.length === 1 }))),
    field('Topic to explore', 'topic', stop.topic, updateStop('topic'), { help: 'Use the exact English Wikipedia article title for the orb world.' }),
    field('Thinking checkpoint', 'prompt', stop.prompt, updateStop('prompt'), { rows: 4, max: 1500, help: 'Ask learners to predict, compare evidence, explain a connection, or revisit their first idea.' }),
    field('Additional source URL (optional)', 'source', stop.source, updateStop('source'), { type: 'url', max: 2000, help: 'A paper, book, video, or other HTTPS resource. Learners open it on the source website.' }),
    element('label', { class: 'check' }, element('input', { type: 'checkbox', checked: stop.required, onchange: event => {
      stop.required = event.target.checked; saveDraft(); renderTeacher(); document.querySelector('.check input').focus();
    } }), 'Ask for a written response before continuing'),
    element('div', { class: 'actions' }, button('Create student link', showShare, { class: 'primary' }), button('Export lesson', exportLesson), button('Import lesson', () => openFile(true), { class: 'quiet' })),
    paragraph('Draft changes save on this device as you type', 'save-status'));
  editor.querySelector('.save-status').id = 'save-status';
  app.replaceChildren(intro, element('div', { class: 'layout' }, sidebar, editor));
}

function showShare() {
  try {
    const encoded = encodeLesson(draft); saveDraft(); clearNotice();
    document.querySelector('#share-panel')?.remove();
    const url = new URL(location.href); url.search = ''; url.hash = `lesson=${encoded}`;
    const input = element('input', { type: 'text', value: url.href, readonly: '', id: 'student-link' });
    const panel = element('section', { class: 'panel share-panel', id: 'share-panel', 'aria-label': 'Share lesson' },
      element('h2', {}, 'One route. Their own thinking.'),
      paragraph('This link contains a copy of the lesson, never journal responses. Anyone with it can read the lesson. Create a new link after editing.'),
      element('label', { for: 'student-link', class: 'field-label' }, 'Student link'), input,
      element('div', { class: 'actions' }, button('Copy link', async () => {
        try { await navigator.clipboard.writeText(url.href); announce('Student link copied.'); }
        catch { input.focus(); input.select(); announce('Select and copy the student link above.'); }
      }, { class: 'primary' }), link('Open student link ↗', url.href)));
    app.append(panel); input.focus(); input.select();
  } catch (error) { announce(error.message, true); }
}

async function openStudent(value, isPreview) {
  const valid = validateLesson(value);
  const stamp = await revisionOf(valid);
  lesson = valid; revision = stamp; preview = isPreview; position = 0; responses = {};
  const saved = getStored(`rh-learning-work-v1:${revision}`);
  if (saved) {
    try { responses = readWork(saved, revision, lesson); }
    catch { storageWarning('Saved responses for this lesson could not be read. Export any new work before leaving.'); }
  }
  clearNotice(); renderStudent(); focusHeading();
}

function visitStop(target) {
  const missing = nextRequired(lesson, responses, target);
  if (target > position && missing !== -1) {
    position = missing; renderStudent(); announce('Add your thinking at this required checkpoint before continuing.', true);
    document.querySelector('#answer').focus(); return;
  }
  position = target; clearNotice(); renderStudent(); document.querySelector('#stop-heading').focus();
}

function renderStudent() {
  activeView = 'student';
  document.title = `${lesson.title} · Rabbit Hole`;
  const stop = lesson.stops[position];
  const answered = lesson.stops.filter(item => checkpointDone(item, responses)).length;
  const intro = element('div', { class: 'intro' }, element('div', {}, element('span', { class: 'eyebrow' }, preview ? 'Student preview · responses are your own' : 'Your learning route'),
    element('h1', { tabindex: '-1' }, lesson.title), paragraph(lesson.objective)),
    element('div', { class: 'actions' }, preview ? button('Back to editor', () => { clearNotice(); renderTeacher(); focusHeading(); }) : element('a', { href: 'lesson.html', class: 'button quiet' }, 'Build a route')));
  const sidebar = element('aside', { class: 'panel sidebar', 'aria-label': 'Your progress' }, element('h2', {}, 'Room to explore'),
    element('p', { id: 'response-count', class: 'muted' }, `${answered} of ${lesson.stops.length} responses recorded`),
    element('progress', { id: 'response-progress', class: 'progress', max: lesson.stops.length, value: answered, 'aria-label': 'Responses recorded' }),
    routeList(lesson, position, visitStop, true), button('Export my journal', exportJournal, { class: 'quiet' }),
    paragraph('Your writing stays in this browser until you choose to export and share it. No responses are sent to a teacher. Shared devices can expose saved work.', 'privacy'));
  const topicURL = new URL('index.html', location.href); topicURL.search = new URLSearchParams({ topic: stop.topic, lang: 'en' }).toString(); topicURL.hash = '';
  const response = responses[stop.id] || { answer: '', evidence: '' };
  const update = key => value => {
    responses[stop.id] = { ...(responses[stop.id] || { answer: '', evidence: '' }), [key]: value }; saveWork();
    const count = lesson.stops.filter(item => checkpointDone(item, responses)).length;
    document.querySelector('#response-count').textContent = `${count} of ${lesson.stops.length} responses recorded`;
    document.querySelector('#response-progress').value = count;
    const current = app.querySelector('.stop[aria-current="step"]');
    const done = checkpointDone(stop, responses);
    current.querySelector('.stop-number').textContent = done ? '✓' : position + 1;
    current.querySelector('.stop-number').classList.toggle('done', done);
    current.querySelector('.stop-meta').textContent = done ? 'Response recorded' : stop.required ? 'Required checkpoint' : 'Optional checkpoint';
  };
  const panel = element('section', { class: 'panel', 'aria-labelledby': 'stop-heading' },
    element('div', { class: 'topic-heading' }, element('span', { class: 'eyebrow' }, `Stop ${position + 1} / ${lesson.stops.length}`),
      element('h2', { id: 'stop-heading', tabindex: '-1' }, stop.topic),
      element('div', { class: 'topic-links' }, link('Explore orb world ↗', topicURL.href), link('Read Wikipedia ↗', wikiURL(stop.topic)), stop.source ? link('Open assigned source ↗', stop.source) : null),
      paragraph('Resources open in a new tab. Return here to keep your thinking together.', 'helper')),
    element('div', { class: 'checkpoint' }, element('span', { class: 'eyebrow' }, stop.required ? 'Pause & think · required' : 'Pause & think · optional'), paragraph(stop.prompt)),
    field('My thinking', 'answer', response.answer, update('answer'), { rows: 6, max: LIMITS.response, className: 'journal', help: 'Use your own words. This checkpoint checks that you wrote a response; it does not grade correctness.' }),
    field('Evidence note (optional)', 'evidence', response.evidence, update('evidence'), { rows: 3, max: LIMITS.response, help: 'Keep source material separate: add the source title or URL, a short passage, and its page or timestamp.' }),
    paragraph('Responses save on this device as you type', 'save-status'),
    element('div', { class: 'student-footer' }, button('← Previous', () => visitStop(position - 1), { class: 'quiet', disabled: position === 0 }),
      button(position === lesson.stops.length - 1 ? 'Review my journal →' : 'Next checkpoint →', () => {
        if (position < lesson.stops.length - 1) visitStop(position + 1);
        else {
          const missing = nextRequired(lesson, responses);
          if (missing !== -1) { position = missing; renderStudent(); announce('Write a response at each required checkpoint before reviewing your route.', true); document.querySelector('#answer').focus(); }
          else { clearNotice(); renderSummary(); focusHeading(); }
        }
      }, { class: 'primary' })));
  panel.querySelector('.save-status').id = 'save-status';
  app.replaceChildren(intro, element('div', { class: 'layout' }, sidebar, panel));
}

function renderSummary() {
  activeView = 'summary';
  app.replaceChildren(element('section', { class: 'panel' }, element('span', { class: 'completion-mark', 'aria-hidden': 'true' }, '◎'),
    element('span', { class: 'eyebrow' }, 'Your route, reflected on'), element('h1', { tabindex: '-1' }, 'What are you taking with you?'),
    paragraph(lesson.title, 'muted'), paragraph('Review how your thinking developed. You can revisit a checkpoint or export your journal to share it.'),
    element('div', { class: 'actions' }, button('Export my journal', exportJournal, { class: 'primary' }), button('Return to route', () => { renderStudent(); focusHeading(); }),
      preview ? button('Back to editor', () => { renderTeacher(); focusHeading(); }, { class: 'quiet' }) : null),
    ...lesson.stops.map((stop, index) => element('section', { class: 'summary-item' }, element('h2', {}, `${index + 1}. ${stop.topic}`),
      paragraph(stop.prompt, 'muted'), paragraph(responses[stop.id]?.answer || 'No response recorded.', 'answer'),
      element('h3', {}, 'Source / evidence note'), paragraph(responses[stop.id]?.evidence || 'No evidence note recorded.', 'evidence'),
      button('Revisit checkpoint', () => { position = index; renderStudent(); document.querySelector('#answer').focus(); }, { class: 'quiet', 'aria-label': `Revisit ${stop.topic}` }))),
    paragraph('Nothing has been submitted. Your teacher sees only the file you choose to share.', 'privacy')));
}

function renderError(error) {
  activeView = 'error';
  app.replaceChildren(element('section', { class: 'panel error-page' }, element('h1', { tabindex: '-1' }, 'This route could not be opened'),
    paragraph(error.message), paragraph('Ask the teacher for a fresh link or their exported lesson file.', 'muted'),
    element('div', { class: 'actions' }, button('Open lesson file', () => openFile(false), { class: 'primary' }), element('a', { class: 'button quiet', href: 'lesson.html' }, 'Build a route'))));
}

async function start() {
  if (location.hash) {
    try {
      if (!location.hash.startsWith('#lesson=')) throw new Error('The lesson link has an unrecognised format.');
      await openStudent(decodeLesson(location.hash.slice(8)), false);
    } catch (error) { renderError(error); }
    return;
  }
  draft = sampleLesson();
  const saved = getStored(DRAFT_KEY);
  if (saved) {
    try { draft = parseLesson(saved, { draft: true }); }
    catch { storageWarning('The previous draft could not be read. This example will replace it only when you edit or share it.'); }
  }
  selectedId = draft.stops[0].id; renderTeacher();
}

// Explain cross-tab updates rather than silently overwriting a draft currently being edited.
addEventListener('storage', event => {
  if (event.key === DRAFT_KEY && activeView === 'teacher') storageWarning('This draft changed in another tab. Export this copy before reloading or continuing to edit.');
  if (event.key === `rh-learning-work-v1:${revision}` && activeView !== 'teacher') storageWarning('This journal changed in another tab. Export this copy before reloading or continuing to write.');
});
addEventListener('hashchange', () => { start(); });
start().catch(renderError);
