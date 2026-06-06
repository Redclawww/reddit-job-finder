# X Recent Search Opportunities Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add optional X recent-search ingestion so the notifier can surface fresh, low-engagement hiring/freelance posts from the last few hours or days alongside Reddit posts.

**Architecture:** Keep the existing Reddit pipeline intact and add a second collector that uses X's official recent-search API. Map X posts into the existing post-processing flow with a conservative config gate for lookback window, query list, and maximum engagement so the matcher/notifier can reuse the current ranking path with minimal churn.

**Tech Stack:** TypeScript, Jest, Axios HTTP client, existing notifier/batch-processing pipeline

---

### Task 1: Lock X ingestion behavior in tests

**Files:**
- Create: `tests/lib/x-scraper.test.ts`
- Modify: `tests/index.test.ts`

**Step 1: Write failing tests**

Add tests that verify:
- X recent search requests include bearer auth, lookback window, and public metrics fields
- returned X posts are filtered to low-engagement items and mapped into the existing post shape
- the main notifier run includes X search results when `xBearerToken` and `xQueries` are configured

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/x-scraper.test.ts tests/index.test.ts`

Expected: FAIL on missing X scraper module / missing config support / missing runtime wiring

### Task 2: Implement the X collector and config surface

**Files:**
- Create: `src/lib/x-scraper.ts`
- Modify: `src/types/index.ts`
- Modify: `src/config/defaults.ts`
- Modify: `src/config/schema.ts`
- Modify: `src/index.ts`

**Step 1: Implement minimal runtime support**

Add:
- optional config for bearer token, query list, lookback hours, max results, and max engagement
- an `XSearchScraper` that calls `GET /2/tweets/search/recent`
- mapping from X API responses into the existing post shape with stable prefixed IDs and X permalinks
- runtime collection logic that appends X results to Reddit results when configured

**Step 2: Run focused tests**

Run: `npm test -- tests/lib/x-scraper.test.ts tests/index.test.ts`

Expected: PASS

### Task 3: Make cross-source output understandable

**Files:**
- Modify: `src/lib/notifier.ts`
- Modify: `src/lib/telegram-notifier.ts`
- Test: `tests/integration/telegram-notifier.test.ts`

**Step 1: Implement minimal notifier clarity**

Add source-aware labels so X matches do not render as fake subreddit output, while preserving current Reddit formatting.

**Step 2: Run notifier test**

Run: `npm test -- tests/integration/telegram-notifier.test.ts`

Expected: PASS

### Task 4: Verify the feature end-to-end

**Files:**
- No code changes

**Step 1: Run focused suite**

Run: `npm test -- tests/lib/x-scraper.test.ts tests/index.test.ts tests/integration/telegram-notifier.test.ts`

Expected: PASS

**Step 2: Run static verification**

Run: `npm run typecheck`

Expected: PASS

**Step 3: Run build**

Run: `npm run build`

Expected: PASS
