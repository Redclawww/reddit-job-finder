# MVP Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the MVP slice of `architecture.md` inside this repo by moving the current scraper toward canonical opportunities, rule filtering, structured profile-based matching, and final ranking, while keeping the existing runtime shell.

**Architecture:** Keep the existing polling/scraping/storage/notifier app shape, but replace the current title-only keyword-plus-score matching path with an MVP matcher pipeline. The MVP will include canonical opportunity building, cheap rule filtering, deterministic structured extraction, profile-based ranking, and richer alert formatting. It will intentionally skip embeddings, feedback loops, outbound-page fetching, queues, and Postgres.

**Tech Stack:** TypeScript, Jest, Puppeteer, Axios, Express

---

### Task 1: Add canonical opportunity and profile support

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/config/profile.ts`
- Create: `src/lib/opportunity.ts`
- Test: `tests/lib/opportunity.test.ts`

**Step 1: Write the failing test**

Add tests for building a canonical opportunity document and canonical text blob from a scraped Reddit post.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/opportunity.test.ts`

Expected: FAIL because no opportunity builder/profile types exist yet.

**Step 3: Write minimal implementation**

Add profile and canonical opportunity types plus a builder that normalizes Reddit posts into architecture-style structured documents.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/opportunity.test.ts`

Expected: PASS

### Task 2: Add MVP rule filtering and ranking

**Files:**
- Modify: `src/lib/batch-processor.ts`
- Modify: `src/types/index.ts`
- Test: `tests/lib/batch-processor.test.ts`

**Step 1: Write the failing test**

Add tests proving the processor:
- rejects `[For Hire]` style posts
- ranks real hiring posts using structured signals
- returns decision reasons and detected skills

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/batch-processor.test.ts`

Expected: FAIL because the current processor only does keyword filtering plus optional AI score thresholding.

**Step 3: Write minimal implementation**

Implement MVP matching:
- build canonical opportunity
- run cheap rule filter
- extract structured facts from text
- combine signals into `finalScore`
- return enriched match results

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/batch-processor.test.ts`

Expected: PASS

### Task 3: Upgrade notifications to reflect the MVP match data

**Files:**
- Modify: `src/lib/telegram-notifier.ts`
- Modify: `src/lib/notifier.ts`
- Test: `tests/integration/telegram-notifier.test.ts`
- Test: `tests/integration/notifier.test.ts`

**Step 1: Write the failing test**

Add assertions for:
- final fit score
- why matched
- required skills
- links

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/telegram-notifier.test.ts tests/integration/notifier.test.ts`

Expected: FAIL because the current payloads do not include the richer architecture-driven fields.

**Step 3: Write minimal implementation**

Update alert formatting to show the structured ranking output.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/telegram-notifier.test.ts tests/integration/notifier.test.ts`

Expected: PASS

### Task 4: Verify the MVP slice end to end

**Files:**
- Modify as needed: `README.md`

**Step 1: Run full verification**

Run:
- `npm test`
- `npm run typecheck`
- `npm run build`

Expected: PASS

**Step 2: Document the scope**

Clarify that the repo now implements the MVP subset of `architecture.md`, not the full production design.
