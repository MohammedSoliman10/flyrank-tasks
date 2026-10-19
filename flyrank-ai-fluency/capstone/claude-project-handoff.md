# Claude Project Handoff

The portfolio build context is preserved in one Claude Project. Adding the next
case is a conversation inside that project, not a rebuild.

## Project

| Field | Value |
| --- | --- |
| Name | **Reliability Portfolio — Mohammed Soliman** |
| Location | Claude → Projects → Reliability Portfolio — Mohammed Soliman |
| Source of truth | [`../task2/claude-project.md`](../task2/claude-project.md) |
| Voice card | Direct, warm, plain, specific. No buzzwords. |
| One action | Book a 20-minute reliability review |
| Sitemap | Home, three cases, About, Contact |

## What it already knows

- The proof statement, pasted in verbatim.
- The six-word voice card.
- The six-page sitemap and the reason the `/work` index was cut.
- The rule: one sharp question at a time, no ghostwriting, no default praise.
- The banned words: *results-driven*, *passionate*, *cutting-edge*, *leverage*,
  *impactful*.
- The instruction not to invent outcomes or claim a live platform send that did
  not happen.

## Why this is preserved

The expensive part of a portfolio is not the HTML. It is the voice, the claim,
the audience, and the interview habit. Rebuilding those for every case would make
the second case cost as much as the first. Keeping the project means case four
starts with a conversation:

```text
Stay in the existing project and keep the voice card. I am adding the fourth
case: a webhook delivery service with HMAC verification, replay protection,
idempotent event storage, retries, and a dead-letter queue. Interview me one
question at a time. Focus on the problem, the decisions I made, and what came of
it. Do not write the case until I have answered.
```

## If the project is ever lost

1. Create a new Claude Project with the same name.
2. Paste the custom instructions block from `task2/claude-project.md`.
3. Paste the proof statement and voice card.
4. Add the decision log below.
5. Do not rewrite the cases. The project is a tutor, not an author.

## Decision log

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-19 | Keep the portfolio to six pages | The pressure test showed `/work` added a click without proof |
| 2026-10-19 | Cut `/work`, add a proof strip to Home | Evidence should appear before the case cards |
| 2026-10-19 | Keep the same CTA everywhere | One action is easier to say yes to |
| 2026-10-19 | Name the fourth case: Webhook Delivery Service | It proves inbound idempotency and replay protection, a new failure surface |
| 2026-10-26 | Reminder starts: collect evidence before drafting | A case without a transcript is fiction |

## What not to do

- Do not create a second project for the next case.
- Do not let the model write the case before the interview.
- Do not add a services page, blog, or testimonials to make the site feel bigger.
- Do not change the claim to “full-stack” or “AI engineer” to widen the audience.
- Do not add a second CTA.
