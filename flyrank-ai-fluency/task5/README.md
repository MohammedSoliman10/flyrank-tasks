# Task 5 — The Prompt Ladder

**Week 2 · General AI Fluency**

Deliverable: a prompt ladder document with the weak baseline, five versions, the
output for each, four notes per version, and the final reusable prompt.

## File

- [`prompt-ladder.md`](./prompt-ladder.md) — the full ladder.

## The ladder

| Run | Layer added | Honest result |
| --- | --- | --- |
| Baseline | none | Generic in-memory scheduler; no persistence or retry safety |
| V1 | Clearer goal | Named the idempotency guarantee, but no system context |
| V2 | Real context | **Made it worse** — 12-file scaffold, Redis appeared, retry proof lost |
| V3 | Constraints | Buildable SQLite claim/lease design; no scary tests yet |
| V4 | Output format | Easier to scan; test names still generic |
| V5 | Verification requirements | Test-first design with the right failure names |

Every version adds exactly one named layer. Nothing is bundled.

## The honest failure

V2 added real context, and the output got worse. The model produced a clean
architecture scaffold and introduced Redis/BullMQ even though the existing app is
SQLite. It also described idempotency as "check whether the slot is already
published", which is a check-then-act race. More context did not mean more
correctness until V3 added constraints.

## The final prompt

The reusable prompt at the end of the document includes role, goal, context,
constraints, output format, and verification requirements. A stranger on the same
track can use it without me in the room.

## What the outputs show

- Baseline: `time.sleep`, an in-memory list, and no tests.
- V1: the first mention of a key, a slot, and an adapter.
- V2: scope inflation and a race hidden inside "check first".
- V3: a transaction, a lease, an attempt cap, and a 429 path.
- V4: schema, claim SQL, pseudocode, and a test matrix separated.
- V5: named failing tests, including *adapter accepted then response lost* and
  *stale publishing lease*.

The last note is honest: the prompt can specify the proof, but it cannot supply
the fixture that writes and throws. That work was done in the capstone repo, where
26 tests pass.
