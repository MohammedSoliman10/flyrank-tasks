# FlyRank AI Fluency

Deliverables for the **General AI Fluency** track, organised as five separate
assignment folders. Each folder has its own README, source text, and any images
or assets needed for submission.

The portfolio subject is **Mohammed Soliman, backend engineer**: the claim is
narrow, the audience is a specific buyer, and the one action is a 20-minute
reliability review.

## Folders

| Folder | Assignment | Deliverable |
| --- | --- | --- |
| [`task2`](./task2) | Week 1 · Draw the path | Portfolio sitemap sketch, Claude Project configuration, pressure-test prompt and output |
| [`task3`](./task3) | Week 1 · What are you proving? | One-paragraph proof statement (claim + person + action) and one-line why |
| [`task4`](./task4) | Week 2 · Frame it as cases | Voice card, three framed case studies, bio, contact/CTA, before/after edit |
| [`task5`](./task5) | Week 2 · The Prompt Ladder | Weak baseline plus five single-layer prompt versions, outputs, notes, final reusable prompt |
| [`capstone`](./capstone) | Week 6 · Impact project | How to add the next case, named next piece, evidence of a recurring reminder, preserved Claude Project handoff |

## The through-line

```text
Claim        I design idempotent, crash-safe backend workflows in Node.js.
Person       A seed-stage SaaS founder or engineering lead with a flaky
             queue, webhook, or retry path and no platform engineer.
Action       Book a 20-minute reliability review.
Portfolio    Six pages: Home, three cases, About, Contact.
Proof        Public test transcripts, not adjectives.
```

## What each folder contains

```text
flyrank-ai-fluency/
├── README.md
├── SUBMISSION.md
├── task2/
│   ├── README.md
│   ├── sitemap.md
│   ├── claude-project.md
│   ├── pressure-test.md
│   └── assets/
│       ├── sitemap-sketch.png
│       ├── claude-project-config.png
│       └── claude-pressure-test.png
├── task3/
│   ├── README.md
│   └── proof-statement.md
├── task4/
│   ├── README.md
│   └── framed-cases.md
├── task5/
│   ├── README.md
│   └── prompt-ladder.md
└── capstone/
    ├── README.md
    ├── how-to-add-next-case.md
    ├── claude-project-handoff.md
    ├── reminder.ics
    └── assets/
        └── reminder-evidence.png
```

## Viewing the deliverables

Open the PNGs directly, or open the Markdown files in GitHub. The HTML source
used to render the screenshots is kept beside each PNG under `assets/` so the
images can be regenerated or edited.

## Provenance note

The Claude Project screenshots are **local renders of the exact configuration
and transcript text** in this repository. No live Claude account was available
in this build environment. The project name, custom instructions, pressure-test
prompt, and output are all included as copy-paste text, so the same project can
be created in Claude without rewriting anything. This is stated openly rather
than presenting a reconstruction as a live capture.

The case-study numbers come from the public repositories in this same GitHub
account:

- `task4` — Supabase Auth API: 16 passing tests.
- `task5` — Books to Scrape: 60 valid books, 11 tests, broken-URL run.
- `social-media-studio` — capstone: 26 tests, ambiguous-timeout and stale-lease
  retry proofs.

## Submission checklist

- [x] Task 2: sitemap image, Claude Project image, prompt + output, one change noted
- [x] Task 3: one-paragraph proof statement + one-line why
- [x] Task 4: voice card + three cases + bio + CTA + before/after
- [x] Task 5: six runs, five single-layer changes, four notes each, final prompt
- [x] Capstone: next-case note, named next piece, reminder `.ics`, reminder image
- [x] Each folder has its own README

## License

MIT. See the repository root for the assignment work and the capstone code.
