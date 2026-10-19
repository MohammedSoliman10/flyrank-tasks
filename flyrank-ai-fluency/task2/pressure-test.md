# Pressure-Test the Sitemap

## The real prompt

```text
Act as a skeptical seed-stage SaaS founder. I have a flaky background-job
pipeline and I might hire someone for a short reliability sprint.

Here is my claim: I design idempotent, crash-safe backend workflows in Node.js.

Here is the person I want to reach: a seed-stage SaaS founder or engineering lead
with a flaky queue, webhook, or retry path and no platform engineer. Here is the
one action: book a 20-minute reliability review.

Here is my sitemap v1:
- Home: claim, three case cards, CTA
- Work index: list of the three cases
- Case: Social Media Studio (idempotent publisher, 26 tests)
- Case: Supabase Auth API (JWT boundary, 16 tests)
- Case: Polite Books to Scrape (60 records, 11 tests, broken URL)
- About: short bio
- Contact: book the review

Pressure-test it:
1. Which page is doing no work toward the action?
2. Where would you stop believing me?
3. What proof would you need before booking the call?
4. What should I cut, reorder, or rewrite?
Be blunt. End with the single smallest change with the highest impact.
```

## The output

> **1. Which page is doing no work?**
>
> The Work index. Home already has the three cards. The index repeats the same
> three links and adds a click between me and the proof. Cut it. Six pages is
> already generous for one action.
>
> **2. Where would I stop believing you?**
>
> At the Home page if it opens with a portrait and a paragraph about curiosity. I
> do not need a personality; I need to know whether you have seen my failure. Put
> the retry problem in the first screen. “One post after a timeout” is the line
> that makes me keep reading.
>
> The About page is the second risk. If it turns into a CV with every tool you
> have touched, I will assume the cases are decoration. Keep it to why you care
> about failure, three proof links, and the CTA.
>
> **3. What proof would I need before booking?**
>
> I want to see that you can tell the difference between “it retries” and “it
> does not duplicate”. Show me a test where the platform accepted the write and
> the response was lost, then show the retry producing one post. Show me a stale
> lease after a worker crash. A screenshot of a green test count is not enough;
> name the failure.
>
> I also want one small sign that you can work with a real system: status codes,
> logs, or a transcript. The auth case can do that if you keep the status table
> short.
>
> **4. What should I cut, reorder, or rewrite?**
>
> Cut the Work index. Keep Home, the three cases, About, Contact.
>
> Reorder Home: claim → proof strip → three cases → about → CTA. The proof strip
> should be three lines, not three paragraphs: 16 auth tests, one post after a
> timeout, 60 records when a URL breaks. Make each number link to the case.
>
> On the case pages, put the failure above the technology. I do not care that it
> is Node.js until I know it survives a duplicate.
>
> Rewrite the CTA so it asks for one small thing: “Bring one failing retry path
> to a 20-minute review.” That is easier to say yes to than “book a call”.
>
> **Smallest high-impact change:** cut `/work` and add a three-line proof strip
> above the case cards on Home.

## What I changed

**Cut the separate `/work` index.** Home is the work index. The visitor should
not have to click a list to reach the proof.

**Added a three-line proof strip to Home** above the case cards:

```text
16 auth tests · one post after a timeout · 60 records when a URL breaks
```

Each number links to its case. This was the pressure test's highest-impact
suggestion because it moves evidence above the fold without adding a page.

**Kept the six-page sitemap** after the cut: Home, three cases, About, Contact.

## What I deliberately did not change

- I did not add a services page. The one action is a review, not a menu.
- I did not add testimonials. I do not have real ones yet; inventing them would
  break the proof.
- I did not add a blog. A thin blog would weaken the claim.

## Follow-up prompt I would use next

```text
Now pressure-test the Home page order: claim, proof strip, three case cards,
short about, CTA. Tell me the first sentence a skeptical founder would delete. Do
not rewrite it for me; ask me one question that helps me rewrite it myself.
```
