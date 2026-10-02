# Build the learning product in complete, usable slices

## 1. Teaching routes — this prototype

Open `lesson.html`. A teacher edits an objective and an ordered route of up to twelve Wikipedia topics. Each stop has a thinking prompt, an optional external resource, and a required/optional response setting. The initial example explores how to evaluate a scientific claim.

Try this acceptance flow:

1. Edit the lesson title, a prompt, and an HTTPS source. Move a stop and reload: the draft should survive.
2. Choose **Try student view**. Attempt to advance with an empty required response. Then write your thinking and a separate evidence note.
3. Open an orb world, explore, and return to the original tab. The journal remains available.
4. Complete the route and export the Markdown journal. Nothing is automatically submitted.
5. Return to the editor and create a student link. Open it in a different browser profile: only the lesson travels. On the same device, the same lesson version intentionally restores that device's responses.
6. Export the lesson JSON, then open that file using **Open lesson file**. Teachers can also import a lesson into the editor after confirming replacement of their existing draft. Export also backs up incomplete drafts; those must be completed in the editor before students can open them.

### Deliberate boundaries

- Static GitHub Pages deployment; no build step, accounts, database, AI calls, or paid service.
- Draft and journal storage use this browser's localStorage. Clearing site data loses them. Export before changing devices or sharing a device. This is not a secure multi-user notebook.
- A student link is an editable, unsigned snapshot encoded in the URL fragment. It contains no responses. Anyone receiving the link can read the lesson. New edits need a new link; this is not an assessment-security mechanism.
- Long routes use a JSON file instead of a link. The reader validates size, version, fields and source URLs before use. Unknown fields are discarded.
- Responses use a SHA-256 digest of the canonical lesson as their storage namespace. Changes to a lesson do not silently reuse old answers. This also means an edited lesson starts a fresh journal.
- Required checkpoints check for a nonblank response, not understanding or correctness. Teachers assess the journal themselves.
- External books, papers and videos open on their original sites. The prototype does not ingest, embed, redistribute or summarise their content.
- Journal exports preserve thinking separately from evidence notes. They are a first notebook slice, not structured citation records or automatic bibliographies.
- Teacher drafts and checkpoint prompts are English in this slice. Orb links explicitly request English Wikipedia without changing the learner's saved language preference.
- The lesson UI has semantic controls, labels, visible focus, device zoom, a linear reading order and no dependency on canvas or WebGL. The existing orb app still has accessibility and resilience work outstanding.
- Online use is expected. There is no promise that external sources or all application files will be available offline.

### Implementation

`learning/model.mjs` owns a versioned lesson schema, validation, sharing, revision IDs and journal export. `learning/app.mjs` owns the DOM interface and local persistence. Imported text is rendered with textContent, never HTML. `lesson.html` applies a restrictive page-specific CSP, loads no third-party scripts, and makes no background API calls.

`index.html` adds entry links and accepts `?topic=Scientific+method&lang=en`. A topic link skips the intro and opens that world. Global explorer keyboard shortcuts now leave form controls and links alone.

Run `node --test tests/*.test.mjs` (Node 22 or newer) and serve the repository with `python -m http.server 5178`. Open `http://localhost:5178/lesson.html`. There are no packages to install. Test mobile layout, keyboard-only use, denied local storage, source failures, JSON import, and the complete sharing/export flow before merging.

### Verification recorded for this draft

Ten automated model checks passed, covering untrusted imports, source URL validation, Unicode sharing, response exclusion, required checkpoints, version isolation and journal export. A separate synthetic DOM smoke check passed teacher editing/autosave/reordering, sharing, completing four checkpoints, exporting evidence notes, and displaying denied-storage errors while keeping export available. These are not browser or accessibility certification.

The cloud browser could not open the local preview (`ERR_BLOCKED_BY_CLIENT`). Actual browser layout, mobile interaction, clipboard/download/file-picker behaviour and the live orb-world integration remain manual review gates before merging. Resolve the earlier launch review's security and resilience issues before inviting real learners to rely on this app.

## 2. A small teacher pilot

Use this with a few teachers and adult learners. Have each teacher create a route from their own material, then watch a learner complete it. Test whether the prompts lead to specific evidence and explanations; do not treat time spent or clicks as understanding. Record where learners get lost, what teachers rewrite, and whether the journal is useful for discussion.

Proceed when teachers can create, share and review a lesson without assistance. Start with higher education or adult learning so the first pilot does not depend on a school-wide identity, consent or administration system.

## 3. Accounts, a real notebook, and classes

Add a small server API and relational database behind the existing interface. Choose the provider after agreeing the first institution, budget and hosting requirements. Keep the orb explorer while moving saved learning data behind authenticated access.

Suggested entities:

| Entity | Purpose |
| --- | --- |
| User / workspace membership | Identity and permissions |
| Topic / typed topic connection | Concepts, prerequisites, citations and contrasts |
| Source / source version | Provenance, access status, identifier, metadata and permitted content |
| Lesson / immutable lesson version / ordered stop | Teacher plan and the exact version assigned |
| Class / enrolment / assignment | Who can access which lesson |
| Notebook / annotation / response | Learner-owned thinking and precisely located source notes |
| Submission / teacher feedback | Explicitly shared work and review |

Private notes remain private unless the learner explicitly submits or shares them. Enforce ownership and class membership on every API operation, with tests for cross-account access. Provide export, deletion, recovery and backups before relying on cloud storage. Keep an immutable lesson version for each assignment, and separate teacher edits from a live cohort's version.

## 4. Source-backed topic hubs

Give each topic a single workspace containing an overview, readings, media, open questions, evidence and personal notes. Connect scholarly and book metadata through server-side adapters, beginning with a small source set. Candidate providers include OpenAlex/Crossref for scholarly metadata and Open Library/Google Books for books; verify their current API access, limits and content terms before implementation.

Store DOI/ISBN or provider identifiers, authors, publication/version dates, source URLs and access state. Distinguish full text, abstract, preview and external-only content. Metadata access is not permission to copy a book or paper. Deduplicate by identifiers, retain provenance, and handle retractions/corrections. Attach notes to a passage, page or media timestamp with a source version rather than just a topic name.

Fetch on demand; cache metadata; cap concurrency; show partial results and retry controls. Avoid loading every source or media item into the orb canvas. Render hubs as accessible document interfaces with a normal list/navigation alternative to the graph.

## 5. Assisted research and richer teaching

Only once source records and permission boundaries work, add optional AI help for question generation, source comparison and teacher prompt drafting. Answers must identify the retrieved passages they use, distinguish inference from quotations, and say when the available evidence is insufficient. Add server-side usage limits and cost reporting. Treat imported documents as untrusted content, not instructions.

Then add optional branches, prerequisite routes, teacher rubrics, explicit submissions and feedback, and reusable resource collections. Add collaboration only when versioning and permissions are settled.

## Deployment path and remaining launch work

Ship this first slice through a reviewed branch/PR, then the existing Pages deployment. A draft PR does not change the live site. The included learning-route CI workflow runs the model checks and interface syntax check with read-only repository permissions. Make it a required check in repository settings before merging, and separately resolve the launch review's outstanding explorer issues: recover from WebGL intro failures, cancel hold zoom on a second pointer, make loading failures bounded and retryable, replace permissive article sanitising, bound image loading, repair offline asset fallback, and improve full keyboard/screen-reader access. Do not describe the teaching prototype as school-ready or as resolving that earlier audit.

For the account-backed phase, use separate preview and production environments, server-only provider credentials, migration checks, backups/restore tests and monitoring. Introduce dependencies only when that next slice needs them.
