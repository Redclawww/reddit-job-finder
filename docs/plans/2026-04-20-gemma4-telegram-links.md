# Gemma 4 And Telegram Link Delivery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Ollama-first AI scoring path with hosted Google Gemma 4 via the Gemini API and ensure Telegram notifications include the actual scraped job link.

**Architecture:** Keep the existing `IGeminiClient` interface and batch processor flow, but replace the current SDK-specific Gemini implementation with a hosted Gemma 4 client that uses the Gemini API over HTTP. Preserve notifier fan-out and update the Telegram payload to include both the Reddit discussion link and the external job link when available.

**Tech Stack:** TypeScript, Jest, Axios, Nock, Node.js

---

### Task 1: Lock in AI client selection behavior

**Files:**
- Modify: `tests/index.test.ts`
- Modify: `src/index.ts`

**Step 1: Write the failing test**

Add a test that instantiates `RedditHireNotifier` and asserts the batch processor receives the hosted Gemini client and that Ollama is no longer selected.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/index.test.ts`

Expected: FAIL because `src/index.ts` still constructs and prefers the Ollama client.

**Step 3: Write minimal implementation**

Remove Ollama client selection from `src/index.ts` and wire the batch processor to `createGeminiClient()` only.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/index.test.ts`

Expected: PASS

### Task 2: Lock in hosted Gemma 4 request behavior

**Files:**
- Create: `tests/lib/gemini.test.ts`
- Modify: `src/lib/gemini.ts`

**Step 1: Write the failing test**

Add a test that verifies the client calls the Gemini API hosted endpoint with the default model `gemma-4-26b-a4b-it` and parses a numeric score from the response.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/gemini.test.ts`

Expected: FAIL because the current implementation still targets the old SDK path and defaults to `gemini-1.5-pro`.

**Step 3: Write minimal implementation**

Replace the old SDK-specific implementation with an Axios-based Gemini API client that:
- requires `GEMINI_API_KEY`
- defaults `GEMINI_MODEL` to `gemma-4-26b-a4b-it`
- calls `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`
- parses text output into the existing `GeminiResponse`

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/gemini.test.ts`

Expected: PASS

### Task 3: Lock in Telegram delivery of the scraped job link

**Files:**
- Create: `tests/integration/telegram-notifier.test.ts`
- Modify: `src/lib/telegram-notifier.ts`

**Step 1: Write the failing test**

Add a notification test that sends a link post and verifies Telegram receives the external job URL in the message body, plus the Reddit discussion link.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/telegram-notifier.test.ts`

Expected: FAIL because the current payload only includes `post.permalink`.

**Step 3: Write minimal implementation**

Update `TelegramNotifier` to include:
- `Job Link: <post.url>` when `post.url` exists
- `Reddit Link: <post.permalink>` always

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/telegram-notifier.test.ts`

Expected: PASS

### Task 4: Refresh environment examples and verify end-to-end startup

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Step 1: Update documentation**

Document Gemma 4 as the hosted default model and remove Ollama-first guidance from the primary path.

**Step 2: Verify the implementation**

Run:
- `npm test -- tests/index.test.ts tests/lib/gemini.test.ts tests/integration/telegram-notifier.test.ts`
- `npm run typecheck`

Expected: PASS
