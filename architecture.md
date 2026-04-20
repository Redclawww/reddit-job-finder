# Reddit Job Matcher Architecture

## Purpose

This document describes a production-oriented architecture for a Reddit job scraper that finds posts matching a specific software profile, ranks them accurately, and sends the best opportunities to Telegram.

The main goal is not just to detect "hiring-ish" posts, but to identify jobs that closely match a defined target profile such as:

- Software Developer
- Full Stack Developer
- Founding Engineer
- Remote startup developer roles

The architecture is designed for:

- high precision
- low false positives
- explainable matches
- robustness under subreddit noise
- easy future tuning and feedback learning

---

## Core Design Principles

### 1. Separate job detection from profile matching
These are different problems and should not be handled by one vague score.

- **Job detection:** Is this post actually a hiring opportunity?
- **Profile matching:** If it is a job, does it fit the target profile?

### 2. Use multiple layers of filtering
A strong system should combine:

- deterministic rules
- semantic similarity
- structured LLM extraction
- final ranking logic

### 3. Prefer structured outputs over freeform scoring
Do not rely on a single AI score. Extract structured job facts and then rank using those facts.

### 4. Learn from feedback
The system should improve over time based on which alerts are marked useful or ignored.

### 5. Keep scraping and matching decoupled
Ingestion should be separate from classification, ranking, and notification.

---

## Recommended High-Level Architecture

```text
Reddit Ingestion Layer
    -> Raw Post Queue
    -> Canonical Opportunity Builder
    -> Rule Filter
    -> Embedding Similarity Service
    -> LLM Extraction Service
    -> Final Ranker
    -> Deduper
    -> Notification Service
    -> Feedback Collector
    -> Profile Tuning Layer
```

---

## End-to-End Flow

1. Poll selected subreddits for new posts.
2. Normalize each post into a canonical opportunity document.
3. Skip duplicates and already processed items.
4. Apply cheap rule-based filtering to remove obvious noise.
5. Compute semantic similarity between the post and your profile.
6. Run LLM extraction on promising candidates.
7. Produce a final weighted score from multiple signals.
8. Notify Telegram only for posts above configured thresholds.
9. Capture user feedback from Telegram interactions.
10. Use feedback to tune ranking thresholds and profile weights.

---

# 1. Ingestion Layer

## Goal
Fetch new Reddit posts reliably and cheaply.

## Recommendation
Use this order of preference:

1. **Primary:** Reddit OAuth API
2. **Secondary:** subreddit JSON or RSS endpoints where useful
3. **Fallback:** HTML scraping with Puppeteer only for recovery cases

## Why
HTML scraping is fragile, slow, and harder to operate. API-based fetching is more stable and easier to paginate and monitor.

## Ingestion Responsibilities
For every post, collect:

- Reddit post ID
- subreddit
- title
- selftext/body
- permalink
- created timestamp
- author
- score/upvotes
- number of comments
- flair
- outbound URL if present
- outbound domain
- raw source payload

## Notes
The matcher should never use only the title. Matching should use:

- title
- selftext
- flair
- outbound URL domain
- subreddit
- optionally fetched outbound job page text

---

# 2. Canonical Opportunity Builder

## Goal
Convert raw Reddit posts into a normalized document suitable for rules, embeddings, and LLM extraction.

## Canonical Document Format
Create a unified text/object form such as:

```json
{
  "post_id": "abc123",
  "subreddit": "forhire",
  "title": "Hiring React / Node developer for MVP",
  "body": "Need someone to build dashboard and API...",
  "flair": "Hiring",
  "author": "username",
  "permalink": "https://reddit.com/...",
  "outbound_url": "https://notion.so/...",
  "outbound_domain": "notion.so",
  "created_at": "2026-04-20T09:30:00Z",
  "reddit_score": 25,
  "comments_count": 7
}
```

## Canonical Text Blob
Also generate a plain text input for downstream tasks:

```text
Subreddit: forhire
Flair: Hiring
Title: Hiring React / Node developer for MVP
Body: Need someone to build dashboard and API...
Outbound domain: notion.so
Author: username
```

## Why this matters
This normalized document becomes the source of truth for:

- rule filters
- embeddings
- extraction prompts
- auditing and debugging

---

# 3. Dedupe Layer

## Goal
Avoid duplicate alerts and repeated processing.

## Do not dedupe only on Reddit post ID
Many jobs appear as:

- reposts
- crossposts
- same external job link across multiple posts
- slightly rewritten titles for the same role

## Recommended Dedupe Keys
Use multiple keys:

- Reddit post ID
- outbound URL hash
- normalized title hash
- approximate semantic similarity to recent already-sent posts

## Dedupe Strategy
- hard dedupe on Reddit ID and exact outbound URL
- soft dedupe on title similarity and job content similarity

---

# 4. Rule Filter Layer

## Goal
Remove obvious noise before using any model.

## Why
This stage should be cheap, fast, and aggressive. It reduces model cost and improves precision.

## Reject Conditions
Examples:

- “for hire” or “hire me” posts
- self-promotion posts
- portfolio advertisements
- design-only or SEO-only roles if out of scope
- low-budget posts below your floor
- internships if unwanted
- posts clearly seeking agencies when you only want individual roles
- geography mismatch if the role is not remote and outside target regions

## Promote Conditions
Examples:

- hiring flair
- phrases like “looking for”, “hiring”, “need developer”, “opening”, “seeking engineer”
- outbound links to job pages or forms
- subreddits with historically strong signal

## Output
The rule filter should produce:

```json
{
  "passes_rules": true,
  "reject_reasons": [],
  "positive_signals": ["hiring_flair", "startup_language"]
}
```

---

# 5. Profile Service

## Goal
Represent your target job profile as structured, versioned data.

## Why
The profile should not be hardcoded in prompts or scattered across conditions.

## Example Profile
```json
{
  "profile_version": "v1",
  "target_roles": [
    "software developer",
    "full stack developer",
    "founding engineer"
  ],
  "core_skills": [
    "javascript",
    "typescript",
    "react",
    "next.js",
    "node.js",
    "postgres",
    "api integration"
  ],
  "nice_to_have": [
    "python",
    "docker",
    "aws"
  ],
  "avoid": [
    "wordpress-only",
    "seo-only",
    "commission-only",
    "unpaid"
  ],
  "employment_preferences": [
    "remote",
    "freelance",
    "contract",
    "startup"
  ],
  "location_preference": "India remote or global remote",
  "seniority_target": "junior-mid",
  "minimum_budget_or_salary": null
}
```

## Requirements
The profile should be:

- editable without code changes
- versioned
- referenced in all ranking results

---

# 6. Semantic Similarity Layer

## Goal
Measure how closely a post resembles the target profile, even when exact keywords are absent.

## Why
Keyword matching misses good posts that use different wording.

Examples of relevant posts that may not match exact title keywords:

- “Need dev to build SaaS MVP”
- “Seeking TypeScript engineer for startup”
- “Hiring someone for dashboard and backend API work”

## Recommended Model Usage
Use an embedding model for retrieval and similarity.

Suggested approach:

- embed the profile document
- embed each canonical opportunity document
- compute cosine similarity

## Output
```json
{
  "embedding_similarity": 0.84,
  "profile_version": "v1"
}
```

## Recommended Uses
Embedding similarity can support:

- initial ranking
- duplicate detection
- clustering similar job posts
- later search and analytics

---

# 7. LLM Extraction Layer

## Goal
Use an LLM to extract structured facts from candidate posts.

## Important Rule
Do **not** ask the model for only a vague match score.

Ask it to return a schema-defined JSON object.

## Responsibilities
The extraction model should answer:

- Is this a genuine job post?
- What kind of role is it?
- What skills are required?
- What seniority does it imply?
- Is it remote, hybrid, or on-site?
- Is there a budget or salary?
- Is there a location restriction?
- Does it fit the target profile?
- Why does it fit or not fit?

## Example Output Schema
```json
{
  "is_job": true,
  "job_category": "software_engineering",
  "role_labels": ["full_stack", "contract", "startup"],
  "required_skills": ["react", "node.js", "typescript"],
  "optional_skills": ["aws"],
  "seniority": "mid",
  "employment_type": "freelance",
  "remote_type": "remote",
  "location_constraint": "none stated",
  "budget_or_salary": "not specified",
  "fit_score": 0.86,
  "reasons_for_fit": [
    "Matches React/Node/TypeScript stack",
    "Contract startup role aligns with preferences"
  ],
  "reasons_against_fit": [
    "Budget not stated"
  ],
  "must_reject": false,
  "confidence": 0.91
}
```

## Best Practice
Only run this stage for posts that already passed rules and are above a minimum embedding similarity threshold.

That reduces cost and noise.

---

# 8. Outbound Page Fetcher

## Goal
Fetch the real job details when a Reddit post links to an external page.

## Why
Many Reddit posts contain only a short teaser. The real requirements are often in:

- Notion pages
- Google Docs
- Typeform pages
- company career pages
- Greenhouse / Lever job listings
- custom landing pages

## Recommendation
If the Reddit post has an outbound link, fetch that page and extract clean readable text.

## Use Cases
The outbound page text should be merged into the canonical opportunity context before LLM extraction.

## Safety and Stability
- apply timeouts
- use size limits
- skip clearly irrelevant domains if needed
- log fetch failures but do not break the pipeline

---

# 9. Final Ranking Layer

## Goal
Combine all signals into a final score used for notification decisions.

## Why
No single signal is sufficient.

A reliable decision should combine:

- rules
- semantic similarity
- extracted skills
- location fit
- employment type fit
- profile alignment
- source quality

## Example Weighted Formula
```text
final_score =
  0.30 * embedding_similarity
+ 0.20 * job_classifier_confidence
+ 0.20 * required_skill_overlap
+ 0.10 * employment_type_match
+ 0.10 * location_match
+ 0.05 * seniority_match
+ 0.05 * subreddit_quality_score
```

## Threshold Strategy
Use multiple thresholds instead of one hard cutoff.

### Strong Match
- send immediately

### Borderline Match
- send in digest mode
- or queue for optional review

### Weak Match
- do not notify

## Output
```json
{
  "final_score": 0.88,
  "decision": "notify_immediately",
  "decision_reasons": [
    "Strong stack match",
    "Remote startup role",
    "High semantic similarity"
  ]
}
```

---

# 10. Notification Layer

## Goal
Send useful, compact, actionable job alerts to Telegram.

## What to Send
Each notification should include:

- title
- subreddit
- fit score
- why it matched
- required skills detected
- location/budget if found
- Reddit link
- external link if present

## Example Telegram Message
```text
Strong Match: 0.88
Title: Hiring React / Node developer for startup MVP
Subreddit: r/forhire
Why matched:
- React + Node + TypeScript detected
- Remote contract role
- Matches startup preference
Links:
- Reddit: ...
- Apply: ...
```

## Recommended Telegram Actions
Use inline buttons:

- Good match
- Bad match
- Ignore similar
- Ignore subreddit
- Ignore domain
- More like this

These actions should generate feedback events stored in the system.

---

# 11. Feedback Collector

## Goal
Capture user responses so the system gets better over time.

## Why
Feedback is the most important long-term quality improvement mechanism.

## Feedback Types
Recommended actions:

- good_match
- bad_match
- muted_subreddit
- muted_domain
- clicked_link
- saved_for_later
- ignored

## How Feedback Helps
Feedback can be used to:

- adjust thresholds
- prioritize strong subreddits
- suppress recurring bad domains
- strengthen preferred role patterns
- create a labeled dataset for future fine-tuning

---

# 12. Data Storage

## Recommendation
Start with Postgres for durability and relational clarity.

SQLite is fine for a prototype, but once you add feedback, audit logs, model outputs, and ranking history, Postgres is a better fit.

## Suggested Tables

### `posts_raw`
Stores raw ingested Reddit data.

Fields:
- id
- reddit_post_id
- subreddit
- raw_payload
- fetched_at

### `posts_normalized`
Stores canonical normalized opportunity records.

Fields:
- id
- reddit_post_id
- canonical_json
- canonical_text
- outbound_url
- outbound_domain
- created_at

### `job_extractions`
Stores structured LLM outputs.

Fields:
- id
- post_id
- model_name
- model_version
- extraction_json
- confidence
- created_at

### `match_scores`
Stores all ranking signals.

Fields:
- id
- post_id
- profile_version
- embedding_similarity
- rule_score
- skill_overlap
- location_match
- final_score
- decision
- created_at

### `notifications`
Stores sent alerts.

Fields:
- id
- post_id
- channel
- recipient
- sent_at
- status

### `feedback_events`
Stores user feedback from Telegram.

Fields:
- id
- post_id
- event_type
- metadata
- created_at

### `profile_versions`
Stores editable versions of the target profile.

Fields:
- id
- version_name
- profile_json
- active
- created_at

---

# 13. Queue and Worker Design

## Goal
Make the system resilient and scalable.

## Recommendation
Use separate queues or worker stages for each major step.

### Suggested Queues
- `ingest_queue`
- `normalize_queue`
- `extract_queue`
- `rank_queue`
- `notify_queue`
- `feedback_queue`

## Why
This gives:

- retries
- isolation of failures
- controlled concurrency
- easier observability
- cleaner code boundaries

## Worker Responsibilities

### Ingest Worker
- poll Reddit
- store raw posts
- enqueue normalized jobs

### Normalize Worker
- build canonical document
- dedupe
- enqueue ranking candidates

### Extraction Worker
- fetch outbound page if needed
- run LLM extraction
- store structured output

### Ranking Worker
- compute final score
- choose decision
- enqueue notification if needed

### Notification Worker
- send Telegram alert
- record sent status

### Feedback Worker
- process inline button responses
- update suppression lists and stats

---

# 14. Subreddit Quality Scoring

## Goal
Learn which subreddits are worth monitoring heavily.

## Why
Different subreddits have very different signal-to-noise ratios.

## Suggested Metrics Per Subreddit
- total posts ingested
- percent classified as jobs
- percent notified
- percent labeled good_match
- percent labeled bad_match
- click-through rate

## Use in Ranking
Maintain a dynamic `subreddit_quality_score` and fold it into final ranking.

This lets the system automatically trust proven subreddits more.

---

# 15. Suppression and Personalization Rules

## Goal
Avoid repeatedly alerting on things you do not want.

## Types of Suppression
- muted subreddit
- muted domain
- muted author
- muted role keywords
- muted budget range
- muted geography

## Example
If you repeatedly mark “WordPress gigs” as bad matches, the system should suppress similar opportunities.

---

# 16. Observability and Metrics

## Goal
Measure whether the system is actually useful.

## Important Metrics

### Ingestion Metrics
- posts fetched per subreddit
- fetch failures
- rate limit events

### Matching Metrics
- posts passing rules
- extraction success rate
- average embedding similarity
- average final score

### Notification Metrics
- alerts sent
- alerts failed
- click-through rate
- positive feedback rate
- negative feedback rate

### Quality Metrics
- precision proxy via good_match rate
- false positive proxy via bad_match rate
- source quality trend

## HTTP Endpoints
Recommended endpoints:
- `/health`
- `/metrics`
- `/ready`

---

# 17. Failure Handling

## Design Goal
Failures in one stage should not crash the entire service.

## Recommendations
- retry transient network errors
- timeout model calls and page fetches
- store error state per job
- use dead-letter queues for repeated failures
- never break polling because of one bad post
- never send duplicate notifications on retries

## Common Failure Cases
- Reddit fetch fails
- outbound page times out
- model call fails
- Telegram API error
- malformed post data

Each of these should be isolated and recoverable.

---

# 18. Recommended Project Structure

```text
src/
  index.ts
  config/
    env.ts
    profile.ts
  ingestion/
    reddit-client.ts
    reddit-poller.ts
    fallback-scraper.ts
  normalize/
    canonical-builder.ts
    text-cleaner.ts
    dedupe.ts
  filtering/
    rule-filter.ts
    suppression.ts
  models/
    embeddings.ts
    extractor.ts
    schemas.ts
  ranking/
    feature-builder.ts
    ranker.ts
    thresholds.ts
  outbound/
    page-fetcher.ts
    content-extractor.ts
  notifications/
    telegram-notifier.ts
    message-builder.ts
    callback-handler.ts
  feedback/
    feedback-service.ts
    learning-signals.ts
  store/
    postgres.ts
    repositories/
  queues/
    queue.ts
    workers/
  metrics/
    metrics.ts
  api/
    health.ts
    metrics.ts
  utils/
    logger.ts
    retry.ts
    hash.ts
```

---

# 19. Suggested Processing Logic

## Pseudocode

```ts
for each subreddit in configuredSubreddits:
  posts = redditClient.fetchNewPosts(subreddit)

  for each post in posts:
    if dedupeStore.seen(post):
      continue

    rawStore.save(post)
    canonical = canonicalBuilder.build(post)

    if suppression.matches(canonical):
      continue

    ruleResult = ruleFilter.evaluate(canonical, activeProfile)
    if !ruleResult.passes_rules:
      continue

    similarity = embeddingService.compare(activeProfile, canonical)
    if similarity < MIN_SIMILARITY:
      continue

    enriched = outboundFetcher.enrichIfNeeded(canonical)
    extraction = llmExtractor.extract(enriched, activeProfile)

    rankingFeatures = featureBuilder.build({
      canonical,
      ruleResult,
      similarity,
      extraction,
      profile: activeProfile
    })

    decision = ranker.decide(rankingFeatures)
    scoreStore.save(decision)

    if decision.notify:
      telegramNotifier.send(messageBuilder.build(decision))
```

---

# 20. Rollout Plan

## Phase 1: Solid Prototype
Build:
- Reddit ingestion
- canonical normalization
- rule filtering
- embedding similarity
- Telegram notifications
- Postgres storage

## Phase 2: Better Precision
Add:
- LLM JSON extraction
- outbound page fetcher
- final weighted ranker
- richer Telegram messages

## Phase 3: Personalization
Add:
- feedback buttons
- suppression lists
- subreddit quality scores
- user-adjustable profile versions

## Phase 4: Learning System
Add:
- labeled dataset export
- offline evaluation
- threshold tuning
- optional fine-tuning for extraction/classification

---

# 21. Minimum Viable Strong Version

If implementation time is limited, build this first:

- Reddit API ingestion
- Postgres
- canonical opportunity builder
- hard rule filter
- embedding similarity against profile
- outbound page fetcher
- Gemma-based JSON extraction
- final weighted score
- Telegram notifications with feedback buttons

This is the smallest version that is still strong enough to produce useful profile-matched job alerts.

---

# 22. Summary

The key improvement over a basic scraper is this shift:

**from:**

```text
poll -> parse -> keyword match -> AI score -> notify
```

**to:**

```text
poll -> normalize -> dedupe
     -> rule filter
     -> semantic similarity
     -> LLM extraction
     -> final ranker
     -> notify
     -> feedback learning
```

That change makes the system:

- more accurate
- more explainable
- easier to debug
- more personalized
- much more solid over time

---

# 23. Final Recommendation

For implementation, prioritize these capabilities in order:

1. canonical normalization
2. rule filtering
3. embedding-based profile similarity
4. structured LLM extraction
5. weighted ranking
6. Telegram feedback collection
7. storage and observability
8. tuning and learning from feedback

If these pieces are implemented cleanly, the Reddit job matcher will move from a simple alert bot to a high-quality personalized opportunity discovery system.
