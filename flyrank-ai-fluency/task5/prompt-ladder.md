# The Prompt Ladder

**Weak baseline → five single-layer improvements → reusable final prompt**

Track: Backend AI Engineering. Task: scheduling a social post without creating a
duplicate when a publish is retried.

The rule for this document: one version adds exactly one layer. If two things
change, it does not count as a version.

## At a glance

| Run | Layer added | Output got better? | Main thing that still failed |
| --- | --- | --- | --- |
| Baseline | none | — | Generic in-memory demo; no persistence or retry safety |
| V1 | Clearer goal | Yes | Named idempotency, but no system context |
| V2 | Real context | **No — it got worse** | 12-file scaffold and Redis appeared; the retry proof disappeared |
| V3 | Constraints | Yes | Focused SQLite design; no scary tests yet |
| V4 | Output format | Partly | Easier to scan; test names were still generic |
| V5 | Verification requirements | Yes | Test-first design with the right failure names |

---

## Baseline — the weak prompt

### Prompt

```text
Write backend code for a social media post scheduler.
```

### Output (excerpt)

```python
import time
import requests

posts = []

def schedule_post(text, publish_at):
    delay = max(0, publish_at - time.time())
    time.sleep(delay)
    response = requests.post(
        "https://api.example.com/posts",
        json={"text": text},
    )
    posts.append({"text": text, "response": response.status_code})
```

### Four notes

- **What changed in the prompt:** Nothing. This is the baseline I would have
  typed a month ago.
- **What actually improved in the output:** Nothing. It runs, but only as a
  single-process demo.
- **What still failed:** No persistence, no approval step, no idempotency key,
  no crash recovery, no rate-limit handling, no tests. `sleep` blocks the whole
  process, and a retry after an accepted request would create a second post.
- **What I would try next:** Say the actual behavioral goal. “Scheduler” is a
  noun; “never create a second post after a retry” is the requirement.

---

## V1 — Clearer goal

**Layer added:** a clearer goal.
**No other layer added.**

### Prompt

```text
Design a Node.js backend service that publishes an approved social post at a
scheduled time and guarantees that retrying the publish never creates a second
post.
```

### Output (excerpt)

> Keep a `slots` table. A worker polls for due slots. Generate a unique
> idempotency key per post and scheduled time, pass it to the adapter, and reuse
> the same key on retry. Add a `SocialPublisher` interface so the scheduler does
> not know which platform it is calling.
>
> ```js
> await adapter.publish({
>   text: variant.text,
>   idempotencyKey: slot.idempotencyKey,
> });
> ```

### Four notes

- **What changed in the prompt:** Added a precise behavioral guarantee: a retry
  must not create a second post.
- **What actually improved in the output:** It stopped writing a `sleep` loop and
  named the core mechanisms: a slot, an idempotency key, a worker, and an adapter
  seam.
- **What still failed:** It hand-waved the hard part. “Generate a unique key” does
  not say where the key is stored, what happens if the process dies after the
  platform accepts, or how a stale worker is recovered. It also ignored the
  review gate (only approved posts may publish).
- **What I would try next:** Add the real repository context so the answer stops
  inventing a greenfield system.

---

## V2 — Real context

**Layer added:** real context.
**No other layer added.**

### Prompt

```text
Design a Node.js backend service that publishes an approved social post at a
scheduled time and guarantees that retrying the publish never creates a second
post.

Context: this is an existing Node.js + Express app using SQLite. The schema
already has posts, variants, slots, and publish_attempts. A worker polls every
second. The adapter interface already exists:
publish({ variant, text, idempotencyKey }). Retries happen after an ambiguous
timeout, not just a clean failure.
```

### Output (excerpt)

> A clean architecture would separate domain entities, use cases, and
> infrastructure. Create `src/domain/entities/Post.js`,
> `src/domain/entities/Slot.js`, `src/use-cases/PublishSlot.js`,
> `src/infrastructure/queue/RedisQueue.js`, and a queue worker. Use BullMQ for
> delayed jobs and a repository interface for storage. On publish, check whether
> the slot is already published before calling the adapter.

### Four notes

- **What changed in the prompt:** Supplied the actual stack, schema, worker
  cadence, adapter signature, and the ambiguous-timeout condition.
- **What actually improved in the output:** It used the real table names and
  mentioned the worker and adapter instead of proposing a generic cron script.
- **What still failed:** **This version made it worse.** It turned a focused
  reliability question into a 12-file clean-architecture scaffold and introduced
  Redis/BullMQ even though the existing app is SQLite. It also described
  idempotency as “check whether the slot is already published”, which is a race:
  two workers can both see `scheduled` and both call the adapter. The retry proof
  disappeared under the architecture.
- **What I would try next:** Stop the scope creep with explicit constraints.

---

## V3 — Constraints

**Layer added:** constraints.
**No other layer added.**

### Prompt

```text
Design a Node.js backend service that publishes an approved social post at a
scheduled time and guarantees that retrying the publish never creates a second
post.

Context: existing Node.js + Express app, SQLite, tables posts/variants/slots/
publish_attempts, worker polls every second, adapter signature
publish({ variant, text, idempotencyKey }), retries after an ambiguous timeout.

Constraints:
- No Redis, no new infrastructure, no second service.
- One worker process, SQLite only.
- Only an approved variant can be scheduled.
- One active slot per variant.
- Unique idempotency key per variant + scheduled time.
- Maximum 3 attempts, then the slot is failed.
- Honor 429 Retry-After before the next attempt.
- Never log platform tokens.
```

### Output (excerpt)

> Claim the slot inside a transaction, so a second worker cannot take it:
>
> ```sql
> UPDATE slots
> SET status = 'publishing', lease_until = :lease_until, updated_at = :now
> WHERE id = :id
>   AND (
>     (status = 'scheduled'
>      AND (next_attempt_at IS NULL OR next_attempt_at <= :now)
>      AND scheduled_for <= :now)
>     OR
>     (status = 'publishing' AND lease_until <= :now)
>   );
> ```
>
> Call `adapter.publish(...)` with the stored key. Only after it returns, commit
> `slots.status = 'published'`, `variants.status = 'published'`, and a
> `publish_attempts` success row in one transaction. On 429, set
> `next_attempt_at = now + retry_after` and return the slot to `scheduled`. On any
> other failure, increment attempts and back off; after three attempts mark the
> slot `failed` while leaving the variant approved.

### Four notes

- **What changed in the prompt:** Added hard constraints that encode the real
  deployment: SQLite, one worker, no new infra, approval gate, attempt cap, 429,
  and no token logging.
- **What actually improved in the output:** It became buildable. The claim is a
  transaction, not a check-then-act. Success is committed only after the adapter
  returns. The 429 path is explicit.
- **What still failed:** It still had no test for the exact failure that matters:
  the platform accepted the write but the response was lost. The stale-lease path
  was described in prose, not proven. It did not say how to simulate a crash.
- **What I would try next:** Force a structure that includes tests, not just
  implementation.

---

## V4 — Output format

**Layer added:** a specified output format.
**No other layer added.**

### Prompt

```text
Design a Node.js backend service that publishes an approved social post at a
scheduled time and guarantees that retrying the publish never creates a second
post.

Context: existing Node.js + Express app, SQLite, tables posts/variants/slots/
publish_attempts, worker polls every second, adapter signature
publish({ variant, text, idempotencyKey }), retries after an ambiguous timeout.

Constraints:
- No Redis, no new infrastructure, no second service.
- One worker process, SQLite only.
- Only an approved variant can be scheduled.
- One active slot per variant.
- Unique idempotency key per variant + scheduled time.
- Maximum 3 attempts, then the slot is failed.
- Honor 429 Retry-After before the next attempt.
- Never log platform tokens.

Return:
1. File tree.
2. Schema SQL.
3. The claim SQL.
4. The publish function as pseudocode.
5. A test matrix with test names.
6. Assumptions.
Keep each code excerpt under 40 lines.
```

### Output (excerpt)

> **1. File tree**
>
> ```text
> src/services/publisher.js
> src/adapters/registry.js
> tests/reliability.test.js
> ```
>
> **2. Schema SQL** — unique `idempotency_key`, index on
> `(status, scheduled_for)`, `lease_until` on `slots`.
>
> **3. Claim SQL** — transaction updates `scheduled → publishing`.
>
> **4. Publish pseudocode** — call adapter, then commit success and attempt row.
>
> **5. Test matrix**
>
> | Test | What it checks |
> | --- | --- |
> | duplicate publish prevented | Same slot does not create two posts |
> | rate limit handled | 429 waits and retries |
> | unapproved schedule rejected | Draft cannot be scheduled |
>
> **6. Assumptions** — single host; adapter is the only network boundary;
> worker crash leaves a lease behind.

### Four notes

- **What changed in the prompt:** Required a specific six-part output and capped
  code excerpts at 40 lines.
- **What actually improved in the output:** It became scannable. The file tree,
  schema, claim, and pseudocode were separated, and the assumptions surfaced.
- **What still failed:** The test names were too generic. “Duplicate publish
  prevented” does not tell me whether it covers an ambiguous timeout, a stale
  lease, or a double call. “Rate limit handled” could mean anything. The shape
  looked complete while the scary cases were still missing.
- **What I would try next:** Add verification requirements that force the tests
  to name the failure.

---

## V5 — Verification requirements

**Layer added:** verification requirements.
**No other layer added.**

### Prompt

```text
Design a Node.js backend service that publishes an approved social post at a
scheduled time and guarantees that retrying the publish never creates a second
post.

Context: existing Node.js + Express app, SQLite, tables posts/variants/slots/
publish_attempts, worker polls every second, adapter signature
publish({ variant, text, idempotencyKey }), retries after an ambiguous timeout.

Constraints:
- No Redis, no new infrastructure, no second service.
- One worker process, SQLite only.
- Only an approved variant can be scheduled.
- One active slot per variant.
- Unique idempotency key per variant + scheduled time.
- Maximum 3 attempts, then the slot is failed.
- Honor 429 Retry-After before the next attempt.
- Never log platform tokens.

Return:
1. File tree.
2. Schema SQL.
3. The claim SQL.
4. The publish function as pseudocode.
5. A test matrix with test names.
6. Assumptions.
Keep each code excerpt under 40 lines.

Verification requirements:
- State assumptions first.
- Write the failing tests before the final implementation order.
- Name each test after the failure, not the feature.
- For each test, say how it fails without the fix.
- Include: adapter writes then throws; stale publishing lease; 429 Retry-After;
  unapproved schedule.
- Give the exact command to run the suite.
- Do not claim correctness without a test name.
```

### Output (excerpt)

> **Assumptions**
> 1. The adapter call is the only external side effect.
> 2. A worker crash can leave a `publishing` row with a lease.
> 3. The mock adapter can be wrapped to write and then throw once.
>
> **Failing tests first**
>
> ```text
> 1. retry after adapter accepted but response lost creates one post
> 2. stale publishing lease from crashed worker is reclaimed without duplicate
> 3. 429 Retry-After delays the next attempt and then succeeds
> 4. unapproved variant cannot be scheduled
> 5. max attempts marks the slot failed without unpublishing the variant
> ```
>
> **How each fails without the fix**
> - (1) Without the unique key, the retry inserts a second mock post.
> - (2) Without a stale-lease claim, the slot stays `publishing` forever.
> - (3) Without `Retry-After`, the worker retries immediately and can exhaust
>   the attempt cap.
> - (4) Without the status guard, a draft reaches the calendar.
>
> **Implementation order**
> 1. Schema + unique key.
> 2. Claim transaction with lease.
> 3. Adapter call with the stored key.
> 4. Success/failure commit.
> 5. 429/backoff.
> 6. Tests above, then the dashboard/history.
>
> **Run**
>
> ```bash
> npm test
> ```
>
> Do not call this finished until test (1) writes once and throws, the retry
> returns the original record, and the final mock count is still one.

### Four notes

- **What changed in the prompt:** Added verification requirements: failing tests
  first, failure-shaped names, how each test fails without the fix, exact command,
  and a ban on unsupported correctness claims.
- **What actually improved in the output:** The test names now describe the
  failure. The implementation order follows the tests. The answer tells me how to
  prove the ambiguous-timeout case, not just how to structure the code.
- **What still failed:** The last step still has to be implemented and run. A
  prompt can specify the proof, but it cannot supply the fixture that writes and
  throws. That is real work in the repo.
- **What I would try next:** Implement exactly this in `social-media-studio`,
  run the tests, and replace the hypothetical output with the actual transcript.
  (Done: 26 tests pass, including the ambiguous-timeout and stale-lease cases.)

---

## What the ladder actually taught me

1. **A stronger goal beats a longer prompt.** V1 improved more than V2, which
   added context but lost the plot.
2. **Constraints are compression.** V3 became useful when it removed Redis and
   forced the design into the existing SQLite system.
3. **Format improves scanning, not correctness.** V4 looked better but still had
   weak tests.
4. **Verification is the layer that changes the work.** V5 made the failure
   cases the first-class output.
5. **One change at a time is the point.** I can now say which layer earned its
   place instead of dumping ten instructions into one prompt.

## The final reusable prompt

Use this as-is for a similar reliability task. Replace the bracketed context, keep
the constraints, and do not remove the verification section.

```text
You are a senior backend engineer helping me design a reliable publish path.

GOAL
Design a Node.js service that publishes an approved item at a scheduled time and
guarantees that a retry never creates a second side effect.

CONTEXT
- Stack: Node.js, Express, SQLite. No Redis or new infrastructure.
- Existing tables: [posts, variants, slots, publish_attempts].
- A worker polls every second.
- Adapter interface: publish({ item, text, idempotencyKey }).
- A retry may happen after an ambiguous timeout.

CONSTRAINTS
- One worker process.
- Only an approved item can be scheduled.
- One active slot per item.
- Unique idempotency key per item + scheduled time.
- Maximum 3 attempts, then the slot is failed.
- Honor 429 Retry-After.
- Never log secrets or tokens.

OUTPUT
1. Assumptions.
2. File tree.
3. Schema SQL.
4. Claim SQL.
5. Publish pseudocode.
6. Test matrix with failure-shaped names.
Keep code excerpts under 40 lines.

VERIFICATION
- Write the failing tests before the implementation order.
- Name each test after the failure, not the feature.
- Explain how each test fails without the fix.
- Include: adapter writes then throws; stale lease; 429 Retry-After; unapproved
  schedule.
- Give the exact test command.
- Do not claim correctness without a named test.
```
