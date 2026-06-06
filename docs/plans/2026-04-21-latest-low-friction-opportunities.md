# Latest Low-Friction Opportunities Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rank and filter Reddit opportunities toward the newest, lowest-interaction buyer-side freelance or developer-hiring posts while hard-rejecting senior and location-restricted roles.

**Architecture:** Extend the MVP opportunity pipeline rather than adding a second matcher. The rule filter should hard-reject senior and location-limited posts, the fact extractor should detect freelance-buyer demand and recency/comment signals, and ranking/notifications should surface outreachability details based on age plus comments.

**Tech Stack:** TypeScript, Jest, existing opportunity pipeline, Telegram/Discord notifiers

---

### Task 1: Lock the new filtering and ranking behavior in tests

**Files:**
- Modify: `tests/lib/opportunity.test.ts`
- Modify: `tests/lib/batch-processor.test.ts`
- Modify: `tests/integration/telegram-notifier.test.ts`

**Step 1: Write failing tests**

Add tests that verify:
- a fresh low-comment freelance hiring post is preferred and includes age/comment reasons
- posts with `US only`, `EU only`, `LATAM only`, or similar location restrictions are rejected
- posts with `senior`, `lead`, or `staff` developer hiring language are rejected
- Telegram output includes recency/comments context for outreach prioritization

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/opportunity.test.ts tests/lib/batch-processor.test.ts tests/integration/telegram-notifier.test.ts`

Expected: FAIL on missing reject reasons / missing ranking reasons / missing notifier fields

### Task 2: Implement buyer-side freelance detection and hard rejections

**Files:**
- Modify: `src/lib/opportunity.ts`
- Modify: `src/types/index.ts`
- Modify: `src/config/profile.ts`

**Step 1: Implement minimal rule changes**

Add:
- hard reject logic for senior roles
- hard reject logic for location-restricted hiring
- freelance-buyer positive signals such as `looking for freelancer`, `need freelance`, `contract project`, `hiring freelancer`
- recency/comment metadata for ranking explanations

**Step 2: Run targeted tests**

Run: `npm test -- tests/lib/opportunity.test.ts tests/lib/batch-processor.test.ts`

Expected: PASS

### Task 3: Surface outreachability in notifications

**Files:**
- Modify: `src/lib/telegram-notifier.ts`
- Modify: `src/lib/notifier.ts`
- Test: `tests/integration/telegram-notifier.test.ts`

**Step 1: Implement notification fields**

Add concise fields for:
- post age in hours
- comments count
- outreachability / why this is fresh and low-competition

**Step 2: Run notifier test**

Run: `npm test -- tests/integration/telegram-notifier.test.ts`

Expected: PASS

### Task 4: Full verification

**Files:**
- No code changes

**Step 1: Run focused suite**

Run: `npm test -- tests/index.test.ts tests/lib/opportunity.test.ts tests/lib/batch-processor.test.ts tests/integration/telegram-notifier.test.ts`

Expected: PASS

**Step 2: Run static verification**

Run: `npm run typecheck`

Expected: PASS

**Step 3: Run build**

Run: `npm run build`

Expected: PASS
