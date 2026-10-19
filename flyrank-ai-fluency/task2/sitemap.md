# Portfolio Sitemap

## The one action

**Book a 20-minute reliability review.** Everything on the site either builds
belief for that action or gets out of the way.

## Claim and person

- **Claim:** I design idempotent, crash-safe backend workflows in Node.js.
- **Person:** a seed-stage SaaS founder or engineering lead with a flaky queue,
  webhook, or retry path and no platform engineer.
- **Action:** book a 20-minute reliability review.

## Sitemap v2 — six pages

```text
/
│  Home
│  Hero: the claim
│  Proof strip: 16 auth tests · one post after a timeout · 60 records when a URL breaks
│  Three case cards → the three pages below
│  Final CTA: book the review
│
├── /work/social-media-studio
│   Problem / decisions / outcome
│   Evidence: 26 tests, retry transcript, stale-lease test
│
├── /work/supabase-auth-api
│   Problem / decisions / outcome
│   Evidence: 16 tests, status-code table, Swagger screenshot
│
├── /work/polite-scraper
│   Problem / decisions / outcome
│   Evidence: 60 records, 11 tests, broken-URL run
│
├── /about
│   Short bio, why reliability, three proof links
│
└── /contact
    Book the 20-minute review
    What to bring: one failing retry path
```

## Why each page earns its place

| Page | Job | What would make it earn its place |
| --- | --- | --- |
| `/` | State the claim and route the visitor to proof | Hero, proof strip, three cards, one CTA |
| Case: Social Media Studio | Prove duplicate-free retries under a crash | Problem, decisions, 26 tests, transcript |
| Case: Supabase Auth API | Prove a tested trust boundary | Problem, decisions, 16 tests, route/status table |
| Case: Polite Scraper | Prove failure isolation and politeness | Problem, decisions, 60 records, broken-URL run |
| `/about` | Let the visitor know who they would work with | Short bio, reliability thesis, proof links, CTA |
| `/contact` | Make the one action easy | Booking form, what to bring, response expectation |

## Pages deliberately cut

| Cut page | Why |
| --- | --- |
| `/work` index | Home already carries the three case cards. A separate index adds a click and repeats the same content. |
| `/blog` | No published writing yet. An empty or thin blog weakens the proof. |
| `/services` | The one action is a review, not a menu of services. |
| `/testimonials` | No real testimonials yet. Do not invent social proof. |
| `/resume` | A PDF CV does not prove retry safety. The case studies do. |
| `/uses` | A tool list is not proof; it is a distraction from the claim. |
| `/now` | Personal-update page with no job for this visitor. |

## Home page order

1. **Hero** — the claim in one sentence, plus the one action.
2. **Proof strip** — three numbers with links to the cases. No logos, no
   testimonials.
3. **Selected work** — three cards, each with the failure and the outcome.
4. **Short about** — two sentences, link to `/about`.
5. **Final CTA** — the same action, not a second action.

## Case page order

1. The failure in plain language.
2. What I decided, including the trade-off.
3. What came of it, with a number and a link to evidence.
4. The next case link / CTA.

## Pressure-test change

The first version included a separate `/work` index. The pressure test asked
which page was doing no work for the action. The answer was `/work`: Home already
has the three cards, and the index only added a click.

**Changed:** cut `/work`; added a proof strip above the case cards on Home. The
visitor now sees evidence before deciding which case to open.

## Navigation

`Home` · `Work` (anchor to the three cards) · `About` · `Book a review`

No dropdowns. No hidden menu. The CTA is the only filled button.
