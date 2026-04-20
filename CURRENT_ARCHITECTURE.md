# Current Architecture

## Overview

This service polls a list of Reddit subreddits, extracts new posts, filters them for hiring relevance, optionally scores them with hosted Google Gemma 4, and sends matching jobs to Discord and/or Telegram.

The main runtime entrypoint is `src/index.ts`.

## High-Level Flow

1. Load configuration from `.env` plus defaults.
2. Create shared infrastructure:
   - `HttpClient`
   - `RedditScraper`
   - `BatchProcessor`
   - `Store` (`memory` or `sqlite`)
   - enabled notifiers (`discord`, `telegram`)
3. Poll each configured subreddit from `old.reddit.com/r/<subreddit>/new/`.
4. Parse posts and skip anything already seen.
5. Apply keyword filtering first.
6. If `GEMINI_API_KEY` exists, score candidate posts with hosted `Gemma 4` through the Gemini API.
7. Send matching posts to the configured notification channels.
8. Expose `/health` and `/metrics` when metrics are enabled.

## Main Components

### 1. Orchestrator

`src/index.ts`

This file wires everything together and runs the polling loop.

Responsibilities:
- config validation
- store selection
- notifier selection
- scrape cycle scheduling
- metrics bookkeeping
- graceful shutdown and one-shot cleanup

### 2. Scraper

`src/lib/scraper.ts`

The scraper uses `puppeteer` to open `old.reddit.com`, then `cheerio` to parse the HTML.

It extracts:
- post id
- title
- author
- subreddit
- Reddit permalink
- score
- timestamp
- external job URL when the Reddit post links off-site

### 3. Store

`src/lib/store/memory-store.ts`
`src/lib/store/sqlite-store.ts`

The store prevents duplicate alerts by tracking seen Reddit post IDs.

Current state:
- `memory`: good for simple/dev runs
- `sqlite`: persists seen posts across restarts
- `mongodb`: declared in config, but not implemented

### 4. Matching And AI Scoring

`src/lib/batch-processor.ts`
`src/lib/gemini.ts`

The matching pipeline is:

1. blacklist obvious "for hire / hire me" posts
2. keyword match on title + author
3. if AI is enabled, batch-score matches with hosted Gemma 4
4. keep only posts above the configured threshold

Current AI path:
- hosted Gemini API
- default model: `gemma-4-26b-a4b-it`
- API auth via `x-goog-api-key`
- rate-limited before requests are sent

If no AI client is configured, keyword matches still go through with a default score.

### 5. Notifications

`src/lib/notifier.ts`
`src/lib/telegram-notifier.ts`

Supported outputs:
- Discord webhook
- Telegram bot message

Current Telegram payload includes:
- post title
- subreddit
- author
- Reddit score
- matched keywords
- AI score when present
- external job link
- Reddit discussion link when different from the job link

### 6. Metrics

`src/index.ts`

An Express server exposes:
- `/health`
- `/metrics`

Tracked counters:
- scrape count
- match count
- notification count
- error count
- last scrape timestamp

## Current Design Notes

- The scraper is browser-based, not Reddit-API-based.
- The system uses one shared scraper/browser instance during runtime.
- Notifications are rate-limited per channel.
- Errors are counted, but some scrape/notification failures are intentionally swallowed so the loop can continue.
- `runOnce()` now cleans up browser/store resources after the cycle completes.
