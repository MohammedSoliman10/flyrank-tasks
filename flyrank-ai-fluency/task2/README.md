# Task 2 — Draw the Path

**Week 1 · General AI Fluency**

Deliverable: a photo of the portfolio sitemap sketch, plus a screenshot of the
configured Claude Project and the pressure-test prompt and output.

## Files

| File | What it is |
| --- | --- |
| [`sitemap.md`](./sitemap.md) | The six-page sitemap, page jobs, cuts, and the change made after the pressure test |
| [`claude-project.md`](./claude-project.md) | Project name, custom instructions, voice card, and first message |
| [`pressure-test.md`](./pressure-test.md) | The real prompt, the tutor's blunt output, and what changed |
| [`assets/sitemap-sketch.png`](./assets/sitemap-sketch.png) | The sitemap sketch image for submission |
| [`assets/claude-project-config.png`](./assets/claude-project-config.png) | The configured project instructions |
| [`assets/claude-pressure-test.png`](./assets/claude-pressure-test.png) | The pressure-test prompt and output |

## What the sketch shows

Six pages, one action:

```text
Home → three cases → About → Contact
```

- Home: claim, three-line proof strip, three case cards, CTA.
- Case 1: Social Media Studio — one post after a timeout.
- Case 2: Supabase Auth API — tested JWT boundary, 16 tests.
- Case 3: Polite Books to Scrape — 60 records when one URL breaks.
- About: short bio, why reliability, proof links.
- Contact: book the 20-minute review.

A separate `/work` index was cut after the pressure test. Home is the index.

## The Claude Project

**Name:** Reliability Portfolio — Mohammed Soliman

The custom instructions include:

- the proof statement, pasted in full;
- the six-word voice card: *Direct, warm, plain, specific. No buzzwords.*;
- a tutor role: one sharp question at a time, no ghostwriting, no default praise;
- the one action and the six-page constraint;
- a ban on invented outcomes and generic AI phrases.

## The pressure-test change

The tutor's smallest high-impact change was: **cut `/work` and add a three-line
proof strip above the case cards on Home.**

I made both changes. The proof strip is:

```text
16 auth tests · one post after a timeout · 60 records when a URL breaks
```

## Pass/revise check

| Criterion | Where it is met |
| --- | --- |
| Sitemap is small and every page earns its place | Six pages; cuts and page jobs are in `sitemap.md` |
| Claude Project has genuine custom instructions | Proof statement pasted verbatim in `claude-project.md`; screenshot matches |
| First prompt pressure-tested the map | `pressure-test.md` includes the prompt and output |
| At least one change noted | `/work` cut; proof strip added to Home |

## Provenance

The two Claude images are local renders of the exact configuration and transcript
text in this folder. No live Claude account was available in this environment.
The content is copy-paste ready: create the project, paste the instructions, and
the screenshots match the configuration.
