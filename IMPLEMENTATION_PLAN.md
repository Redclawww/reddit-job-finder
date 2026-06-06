Reddit Hire Notifier — Implementation Plan
Focused scope: Reddit source + Discord notifications only.
This file turns the refined architecture into a concrete implementation roadmap for a local-first TypeScript app that finds high-quality job/freelance leads from Reddit and sends the best matches to Discord.

1. Goal
Build a local-first job lead engine that:
1.	Polls selected Reddit subreddits.
2.	Normalizes posts into a canonical lead format.
3.	Deduplicates leads using SQLite.
4.	Applies cheap rule-based filtering.
5.	Optionally scores leads with Gemma 4.
6.	Ranks leads based on fit, freshness, and competition.
7.	Sends high-quality matches to Discord.
8.	Stores all results for debugging and future improvement.
For now, do not implement:
·	X/Twitter
·	Telegram
·	HN
·	RSS feeds
·	Dashboard
·	Feedback buttons
·	Embeddings
Those can be added after the Reddit + Discord version is stable.

2. High-Level Flow
graph TD
    A[Polling Loop] --> B[Reddit Source]
    B --> C[Raw Lead Store]
    C --> D[Deduplication]
    D --> E[Canonical Lead Builder]
    E --> F[Lead Enrichment]
    F --> G[Rule-Based Filter]
    G --> H{Gemma Enabled?}
    H -->|Yes| I[Gemma 4 Lead Scoring]
    H -->|No| J[Heuristic Score Only]
    I --> K[Final Ranker]
    J --> K
    K --> L{Score >= Threshold?}
    L -->|Yes| M[Discord Notifier]
    L -->|No| N[Store as Rejected / Low Priority]


3. Recommended Folder Structure
src/
  index.ts

  config/
    schema.ts
    profile.ts

  sources/
    reddit/
      reddit-source.ts
      reddit-html-source.ts
      subreddits.ts

  leads/
    types.ts
    canonicalize.ts
    enrich.ts
    dedupe.ts

  scoring/
    heuristic-score.ts
    gemma-score.ts
    final-ranker.ts
    prompts.ts

  notifications/
    discord.ts
    templates.ts

  store/
    sqlite.ts
    migrations.ts
    lead-repository.ts

  server/
    app.ts
    routes/
      health.ts
      metrics.ts

  utils/
    logger.ts
    sleep.ts
    hash.ts
    time.ts


4. Environment Variables
Create .env:
NODE_ENV=development

POLL_INTERVAL_MS=900000
PORT=3000

DATABASE_PATH=./data/reddit-hire-notifier.sqlite

REDDIT_USER_AGENT=reddit-hire-notifier/1.0 by your_username
REDDIT_SUBREDDITS=forhire,freelance_forhire,jobbit,remotejs,webdev,startups,SaaS,Entrepreneur,nextjs,reactjs,node,typescript

DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

AI_ENABLED=true
GEMMA_API_KEY=your_google_or_vertex_key
GEMMA_MODEL=gemma-4-26b-a4b-it

MIN_NOTIFY_SCORE=0.72
MAX_POST_AGE_HOURS=48


5. Profile Config
Create src/config/profile.ts.
This is what makes the scraper personal to you.
export const userProfile = {
  targetRoles: [
    "Full Stack Developer",
    "Frontend Developer",
    "Founding Engineer",
    "AI App Developer",
    "Automation Developer",
    "Freelance SaaS Developer",
    "MVP Developer",
  ],

  skills: [
    "TypeScript",
    "JavaScript",
    "Next.js",
    "React",
    "Node.js",
    "Express",
    "PostgreSQL",
    "Supabase",
    "Prisma",
    "AI APIs",
    "LLM apps",
    "automation",
    "web scraping",
    "Telegram bots",
    "Discord bots",
    "dashboards",
    "Stripe",
    "SaaS",
  ],

  preferredOpportunityTypes: [
    "freelance",
    "contract",
    "part-time",
    "remote",
    "startup",
    "founding engineer",
  ],

  avoid: [
    "unpaid",
    "equity only",
    "commission only",
    "onsite only",
    "US citizens only",
    "10+ years",
    "senior staff",
    "principal engineer",
    "FAANG only",
  ],

  minimumMonthlyUsd: 1000,
  minimumHourlyUsd: 20,

  profileText: `
I am a full-stack TypeScript developer focused on Next.js, React, Node.js, PostgreSQL, Supabase, AI apps, automation, web scraping, dashboards, SaaS tools, and API integrations.

I prefer remote freelance, contract, part-time, founding engineer, MVP build, and early-stage startup opportunities.

I am not interested in unpaid work, equity-only roles, commission-only work, onsite-only roles, or jobs requiring very senior enterprise experience.
`.trim(),
};


6. Core Types
Create src/leads/types.ts.
export type Source = "reddit";

export type OpportunityType =
  | "job"
  | "freelance"
  | "contract"
  | "internship"
  | "bounty"
  | "technical_problem"
  | "cofounder_search"
  | "unknown";

export type RawRedditPost = {
  id: string;
  subreddit: string;
  title: string;
  body?: string;
  author?: string;
  url: string;
  permalink: string;
  createdAt: string;
  score?: number;
  comments?: number;
  flair?: string;
  raw: unknown;
};

export type CanonicalLead = {
  id: string;
  source: Source;
  sourceId: string;
  sourceUrl: string;
  title: string;
  body: string;
  author?: string;
  createdAt: string;
  collectedAt: string;

  subreddit?: string;
  flair?: string;

  company?: string;
  role?: string;
  opportunityType: OpportunityType;
  location?: string;
  remote?: boolean;

  budget?: {
    min?: number;
    max?: number;
    currency?: string;
    period?: "hour" | "month" | "year" | "project";
  };

  techStack: string[];
  contactMethod?: string;

  engagement: {
    score?: number;
    comments?: number;
  };

  rawText: string;
  canonicalHash: string;
};

export type HeuristicScore = {
  passed: boolean;
  score: number;
  positiveSignals: string[];
  negativeSignals: string[];
  rejectionReasons: string[];
};

export type AiLeadScore = {
  isOpportunity: boolean;
  opportunityType: OpportunityType;
  fitScore: number;
  urgencyScore: number;
  competitionScore: number;
  budgetScore: number;
  trustScore: number;
  replyWorthiness: number;
  finalScore: number;
  matchingReasons: string[];
  concerns: string[];
  suggestedReply?: string;
  tags: string[];
};

export type FinalLeadScore = {
  leadId: string;
  heuristicScore: number;
  aiScore?: number;
  freshnessScore: number;
  competitionScore: number;
  finalScore: number;
  reasons: string[];
  concerns: string[];
  suggestedReply?: string;
};


7. Reddit Subreddit Config
Create src/sources/reddit/subreddits.ts.
export const defaultSubreddits = [
  "forhire",
  "freelance_forhire",
  "jobbit",
  "remotejs",
  "webdev",
  "startups",
  "SaaS",
  "Entrepreneur",
  "nextjs",
  "reactjs",
  "node",
  "typescript",
];

export const subredditGroups = {
  directHiring: [
    "forhire",
    "freelance_forhire",
    "jobbit",
    "remotejs",
  ],

  founderProblems: [
    "SaaS",
    "Entrepreneur",
    "startups",
    "SideProject",
  ],

  techSpecific: [
    "webdev",
    "nextjs",
    "reactjs",
    "node",
    "typescript",
  ],
};


8. Reddit Source
Use Reddit JSON endpoints first because they are easier than Puppeteer.
Create src/sources/reddit/reddit-source.ts.
import { RawRedditPost } from "../../leads/types";

type RedditListingResponse = {
  data: {
    children: Array<{
      data: {
        id: string;
        subreddit: string;
        title: string;
        selftext?: string;
        author?: string;
        url: string;
        permalink: string;
        created_utc: number;
        score?: number;
        num_comments?: number;
        link_flair_text?: string;
      };
    }>;
  };
};

export class RedditSource {
  constructor(
    private readonly userAgent: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async fetchSubredditNew(
    subreddit: string,
    limit = 25
  ): Promise<RawRedditPost[]> {
    const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;

    const res = await this.fetchImpl(url, {
      headers: {
        "User-Agent": this.userAgent,
      },
    });

    if (!res.ok) {
      throw new Error(
        `Failed to fetch r/${subreddit}: ${res.status} ${res.statusText}`
      );
    }

    const json = (await res.json()) as RedditListingResponse;

    return json.data.children.map((child) => {
      const post = child.data;

      return {
        id: `reddit:${post.id}`,
        subreddit: post.subreddit,
        title: post.title ?? "",
        body: post.selftext ?? "",
        author: post.author,
        url: post.url,
        permalink: `https://www.reddit.com${post.permalink}`,
        createdAt: new Date(post.created_utc * 1000).toISOString(),
        score: post.score,
        comments: post.num_comments,
        flair: post.link_flair_text,
        raw: post,
      };
    });
  }

  async fetchManySubreddits(
    subreddits: string[],
    limitPerSubreddit = 25
  ): Promise<RawRedditPost[]> {
    const allPosts: RawRedditPost[] = [];

    for (const subreddit of subreddits) {
      try {
        const posts = await this.fetchSubredditNew(
          subreddit,
          limitPerSubreddit
        );

        allPosts.push(...posts);

        // Small delay to avoid hammering Reddit.
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (error) {
        console.error(`[reddit] Failed r/${subreddit}`, error);
      }
    }

    return allPosts;
  }
}


9. Hash Utility
Create src/utils/hash.ts.
import crypto from "node:crypto";

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}


10. Canonical Lead Builder
Create src/leads/canonicalize.ts.
import { RawRedditPost, CanonicalLead } from "./types";
import { sha256 } from "../utils/hash";

export function canonicalizeRedditPost(post: RawRedditPost): CanonicalLead {
  const rawText = [post.title, post.body].filter(Boolean).join("\n\n");

  const canonicalHash = sha256(
    [
      "reddit",
      post.title.trim().toLowerCase(),
      post.body?.trim().toLowerCase() ?? "",
      post.permalink,
    ].join("|")
  );

  return {
    id: post.id,
    source: "reddit",
    sourceId: post.id,
    sourceUrl: post.permalink,
    title: post.title,
    body: post.body ?? "",
    author: post.author,
    createdAt: post.createdAt,
    collectedAt: new Date().toISOString(),

    subreddit: post.subreddit,
    flair: post.flair,

    opportunityType: "unknown",
    techStack: [],
    engagement: {
      score: post.score,
      comments: post.comments,
    },

    rawText,
    canonicalHash,
  };
}


11. Lead Enrichment
This is a cheap local extraction step before AI.
Create src/leads/enrich.ts.
import { CanonicalLead } from "./types";

const techKeywords = [
  "typescript",
  "javascript",
  "next.js",
  "nextjs",
  "react",
  "node",
  "node.js",
  "express",
  "postgres",
  "postgresql",
  "supabase",
  "prisma",
  "mongodb",
  "ai",
  "llm",
  "openai",
  "gemini",
  "automation",
  "scraper",
  "web scraping",
  "dashboard",
  "stripe",
  "saas",
  "tailwind",
  "python",
  "fastapi",
];

const remoteKeywords = [
  "remote",
  "work from anywhere",
  "anywhere",
  "async",
];

const freelanceKeywords = [
  "freelance",
  "contract",
  "contractor",
  "part-time",
  "part time",
  "gig",
  "project",
];

const jobKeywords = [
  "hiring",
  "hire",
  "looking for developer",
  "looking for a developer",
  "looking for engineer",
  "founding engineer",
];

const technicalProblemKeywords = [
  "need help",
  "how do i build",
  "how to build",
  "looking for someone to build",
  "can someone build",
  "need someone to build",
];

export function enrichLead(lead: CanonicalLead): CanonicalLead {
  const text = lead.rawText.toLowerCase();

  const techStack = techKeywords.filter((keyword) =>
    text.includes(keyword.toLowerCase())
  );

  const remote = remoteKeywords.some((keyword) => text.includes(keyword));

  let opportunityType = lead.opportunityType;

  if (freelanceKeywords.some((keyword) => text.includes(keyword))) {
    opportunityType = "freelance";
  } else if (jobKeywords.some((keyword) => text.includes(keyword))) {
    opportunityType = "job";
  } else if (
    technicalProblemKeywords.some((keyword) => text.includes(keyword))
  ) {
    opportunityType = "technical_problem";
  }

  return {
    ...lead,
    remote,
    opportunityType,
    techStack: [...new Set(techStack)],
    budget: extractBudget(text),
    contactMethod: extractContactMethod(lead.rawText),
  };
}

function extractBudget(text: string): CanonicalLead["budget"] | undefined {
  const usdHourly = text.match(/\$([0-9]{2,4})\s*\/?\s*(hr|hour)/i);
  if (usdHourly) {
    return {
      min: Number(usdHourly[1]),
      currency: "USD",
      period: "hour",
    };
  }

  const usdProject = text.match(/\$([0-9]{3,6})\s*(project|fixed|budget)?/i);
  if (usdProject) {
    return {
      min: Number(usdProject[1]),
      currency: "USD",
      period: "project",
    };
  }

  return undefined;
}

function extractContactMethod(text: string): string | undefined {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) return email[0];

  if (/dm me|send me a dm|pm me|message me/i.test(text)) {
    return "DM";
  }

  if (/apply/i.test(text)) {
    return "Apply link";
  }

  return undefined;
}


12. Heuristic Scoring
Create src/scoring/heuristic-score.ts.
import { CanonicalLead, HeuristicScore } from "../leads/types";
import { userProfile } from "../config/profile";

const hardRejectPatterns = [
  /\bhire me\b/i,
  /\bfor hire\b/i,
  /\blooking for work\b/i,
  /\blooking for job\b/i,
  /\bneed a job\b/i,
  /\bresume review\b/i,
  /\bunpaid\b/i,
  /\bvolunteer only\b/i,
  /\bequity only\b/i,
  /\bcommission only\b/i,
  /\bonsite only\b/i,
];

const positiveSignals: Record<string, number> = {
  "founding engineer": 10,
  "full stack": 9,
  "full-stack": 9,
  "typescript": 8,
  "next.js": 8,
  "nextjs": 8,
  "react": 7,
  "node": 7,
  "node.js": 7,
  "ai app": 9,
  "llm": 8,
  "automation": 8,
  "scraper": 8,
  "web scraping": 8,
  "saas": 8,
  "mvp": 8,
  "contract": 7,
  "freelance": 8,
  "part-time": 7,
  "part time": 7,
  "remote": 6,
  "dashboard": 6,
};

const negativeSignals: Record<string, number> = {
  "unpaid": -20,
  "equity only": -20,
  "commission only": -20,
  "hire me": -15,
  "for hire": -12,
  "looking for work": -15,
  "senior staff": -8,
  "principal engineer": -8,
  "10+ years": -8,
  "onsite only": -10,
  "us citizens only": -10,
};

export function scoreLeadHeuristically(lead: CanonicalLead): HeuristicScore {
  const text = lead.rawText.toLowerCase();
  const rejectionReasons: string[] = [];

  for (const pattern of hardRejectPatterns) {
    if (pattern.test(text)) {
      rejectionReasons.push(`Hard reject pattern matched: ${pattern}`);
    }
  }

  if (isTooOld(lead.createdAt)) {
    rejectionReasons.push("Lead is too old");
  }

  const matchedPositive: string[] = [];
  const matchedNegative: string[] = [];

  let rawScore = 0;

  for (const [keyword, value] of Object.entries(positiveSignals)) {
    if (text.includes(keyword)) {
      rawScore += value;
      matchedPositive.push(keyword);
    }
  }

  for (const [keyword, value] of Object.entries(negativeSignals)) {
    if (text.includes(keyword)) {
      rawScore += value;
      matchedNegative.push(keyword);
    }
  }

  for (const skill of userProfile.skills) {
    if (text.includes(skill.toLowerCase())) {
      rawScore += 2;
      matchedPositive.push(`skill:${skill}`);
    }
  }

  // Engagement adjustment.
  // Low comments = potentially less competition.
  const comments = lead.engagement.comments ?? 0;
  if (comments <= 2) rawScore += 5;
  else if (comments <= 10) rawScore += 2;
  else if (comments > 40) rawScore -= 4;

  // Normalize score to 0-1.
  const normalizedScore = Math.max(0, Math.min(1, rawScore / 40));

  const passed =
    rejectionReasons.length === 0 &&
    normalizedScore >= 0.25 &&
    matchedPositive.length > 0;

  return {
    passed,
    score: normalizedScore,
    positiveSignals: matchedPositive,
    negativeSignals: matchedNegative,
    rejectionReasons,
  };
}

function isTooOld(createdAt: string): boolean {
  const maxAgeHours = Number(process.env.MAX_POST_AGE_HOURS ?? 48);
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const ageHours = (now - created) / (1000 * 60 * 60);

  return ageHours > maxAgeHours;
}


13. Gemma Prompt
Create src/scoring/prompts.ts.
import { CanonicalLead } from "../leads/types";
import { userProfile } from "../config/profile";

export function buildGemmaLeadScoringPrompt(leads: CanonicalLead[]) {
  return {
    system: `
You are a strict job and freelance lead evaluator.

You evaluate whether Reddit posts are worth replying to for this candidate.

Rules:
- Return valid JSON only.
- Do not invent missing details.
- Reject posts where the author is looking for work rather than hiring.
- Reject unpaid, equity-only, spam, vague, and low-intent posts.
- Prefer remote freelance, contract, part-time, startup, MVP, SaaS, AI app, automation, and full-stack opportunities.
- A technical problem can be a good lead if the person may need a developer.
`.trim(),

    prompt: `
Candidate profile:
${userProfile.profileText}

Evaluate these leads:
${JSON.stringify(
  leads.map((lead) => ({
    id: lead.id,
    title: lead.title,
    body: lead.body,
    subreddit: lead.subreddit,
    flair: lead.flair,
    url: lead.sourceUrl,
    createdAt: lead.createdAt,
    comments: lead.engagement.comments,
    score: lead.engagement.score,
    techStack: lead.techStack,
    opportunityType: lead.opportunityType,
    budget: lead.budget,
    contactMethod: lead.contactMethod,
  })),
  null,
  2
)}

Return exactly this JSON shape:
{
  "results": [
    {
      "id": "lead id",
      "isOpportunity": true,
      "opportunityType": "freelance",
      "fitScore": 0.0,
      "urgencyScore": 0.0,
      "competitionScore": 0.0,
      "budgetScore": 0.0,
      "trustScore": 0.0,
      "replyWorthiness": 0.0,
      "finalScore": 0.0,
      "matchingReasons": [],
      "concerns": [],
      "suggestedReply": "",
      "tags": []
    }
  ]
}
`.trim(),
  };
}


14. Gemma Scoring Client
Create src/scoring/gemma-score.ts.
This implementation uses a generic HTTP shape. Adjust the URL/body depending on whether you call Google AI Studio, Vertex AI, OpenRouter, or another hosted provider.
import { AiLeadScore, CanonicalLead } from "../leads/types";
import { buildGemmaLeadScoringPrompt } from "./prompts";

type GemmaResponse = {
  results: Array<AiLeadScore & { id: string }>;
};

export class GemmaScorer {
  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async scoreLeads(leads: CanonicalLead[]): Promise<Map<string, AiLeadScore>> {
    if (leads.length === 0) return new Map();

    const prompt = buildGemmaLeadScoringPrompt(leads);

    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + this.model + ":generateContent?key=" + this.apiKey, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${prompt.system}\n\n${prompt.prompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemma scoring failed: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    const text =
      json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Gemma response did not contain text");
    }

    const parsed = JSON.parse(text) as GemmaResponse;

    const map = new Map<string, AiLeadScore>();

    for (const result of parsed.results ?? []) {
      const { id, ...score } = result;
      map.set(id, score);
    }

    return map;
  }
}


15. Final Ranker
Create src/scoring/final-ranker.ts.
import {
  AiLeadScore,
  CanonicalLead,
  FinalLeadScore,
  HeuristicScore,
} from "../leads/types";

export function rankLead(
  lead: CanonicalLead,
  heuristic: HeuristicScore,
  ai?: AiLeadScore
): FinalLeadScore {
  const freshnessScore = calculateFreshnessScore(lead.createdAt);
  const competitionScore = calculateCompetitionScore(
    lead.engagement.comments ?? 0
  );

  const aiScore = ai?.finalScore;

  const finalScore = ai
    ? heuristic.score * 0.2 +
      ai.finalScore * 0.55 +
      freshnessScore * 0.15 +
      competitionScore * 0.1
    : heuristic.score * 0.65 +
      freshnessScore * 0.2 +
      competitionScore * 0.15;

  return {
    leadId: lead.id,
    heuristicScore: heuristic.score,
    aiScore,
    freshnessScore,
    competitionScore,
    finalScore: clamp01(finalScore),
    reasons: ai?.matchingReasons ?? heuristic.positiveSignals,
    concerns: ai?.concerns ?? heuristic.negativeSignals,
    suggestedReply: ai?.suggestedReply,
  };
}

function calculateFreshnessScore(createdAt: string): number {
  const ageHours =
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);

  if (ageHours <= 2) return 1;
  if (ageHours <= 12) return 0.8;
  if (ageHours <= 24) return 0.6;
  if (ageHours <= 48) return 0.35;

  return 0.1;
}

function calculateCompetitionScore(comments: number): number {
  if (comments <= 2) return 1;
  if (comments <= 10) return 0.75;
  if (comments <= 30) return 0.45;

  return 0.2;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}


16. SQLite Schema
Create src/store/migrations.ts.
export const migrations = [
  \`
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    author TEXT,
    subreddit TEXT,
    flair TEXT,
    created_at TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    canonical_hash TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    json TEXT NOT NULL
  );
  \`,

  \`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_canonical_hash
  ON leads(canonical_hash);
  \`,

  \`
  CREATE TABLE IF NOT EXISTS lead_scores (
    lead_id TEXT PRIMARY KEY,
    heuristic_score REAL NOT NULL,
    ai_score REAL,
    freshness_score REAL NOT NULL,
    competition_score REAL NOT NULL,
    final_score REAL NOT NULL,
    reasons_json TEXT NOT NULL,
    concerns_json TEXT NOT NULL,
    suggested_reply TEXT,
    scored_at TEXT NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  );
  \`,

  \`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  );
  \`,

  \`
  CREATE TABLE IF NOT EXISTS source_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    fetched_count INTEGER DEFAULT 0,
    new_count INTEGER DEFAULT 0,
    matched_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0
  );
  \`,
];


17. SQLite Connection
Create src/store/sqlite.ts.
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { migrations } from "./migrations";

export function createDatabase(databasePath: string) {
  const dir = path.dirname(databasePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(databasePath);

  db.pragma("journal_mode = WAL");

  for (const migration of migrations) {
    db.exec(migration);
  }

  return db;
}

export type AppDatabase = ReturnType<typeof createDatabase>;


18. Lead Repository
Create src/store/lead-repository.ts.
import { AppDatabase } from "./sqlite";
import { CanonicalLead, FinalLeadScore } from "../leads/types";

export class LeadRepository {
  constructor(private readonly db: AppDatabase) {}

  hasLead(id: string, canonicalHash: string): boolean {
    const row = this.db
      .prepare(
        \`
        SELECT id FROM leads
        WHERE id = ? OR canonical_hash = ?
        LIMIT 1
        \`
      )
      .get(id, canonicalHash);

    return Boolean(row);
  }

  insertLead(lead: CanonicalLead): void {
    this.db
      .prepare(
        \`
        INSERT OR IGNORE INTO leads (
          id,
          source,
          source_id,
          source_url,
          title,
          body,
          author,
          subreddit,
          flair,
          created_at,
          collected_at,
          canonical_hash,
          raw_text,
          json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        \`
      )
      .run(
        lead.id,
        lead.source,
        lead.sourceId,
        lead.sourceUrl,
        lead.title,
        lead.body,
        lead.author ?? null,
        lead.subreddit ?? null,
        lead.flair ?? null,
        lead.createdAt,
        lead.collectedAt,
        lead.canonicalHash,
        lead.rawText,
        JSON.stringify(lead)
      );
  }

  insertScore(score: FinalLeadScore): void {
    this.db
      .prepare(
        \`
        INSERT OR REPLACE INTO lead_scores (
          lead_id,
          heuristic_score,
          ai_score,
          freshness_score,
          competition_score,
          final_score,
          reasons_json,
          concerns_json,
          suggested_reply,
          scored_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        \`
      )
      .run(
        score.leadId,
        score.heuristicScore,
        score.aiScore ?? null,
        score.freshnessScore,
        score.competitionScore,
        score.finalScore,
        JSON.stringify(score.reasons),
        JSON.stringify(score.concerns),
        score.suggestedReply ?? null,
        new Date().toISOString()
      );
  }

  insertNotification(
    leadId: string,
    channel: "discord",
    status: "sent" | "failed",
    error?: string
  ): void {
    this.db
      .prepare(
        \`
        INSERT INTO notifications (
          lead_id,
          channel,
          sent_at,
          status,
          error
        ) VALUES (?, ?, ?, ?, ?)
        \`
      )
      .run(
        leadId,
        channel,
        new Date().toISOString(),
        status,
        error ?? null
      );
  }
}


19. Discord Template
Create src/notifications/templates.ts.
import { CanonicalLead, FinalLeadScore } from "../leads/types";

export function buildDiscordEmbed(lead: CanonicalLead, score: FinalLeadScore) {
  const percent = Math.round(score.finalScore * 100);

  return {
    title: \`🔥 \${percent}% Match: \${lead.title}\`.slice(0, 256),
    url: lead.sourceUrl,
    description: buildDescription(lead, score).slice(0, 4096),
    color: score.finalScore >= 0.85 ? 0x2ecc71 : 0xf1c40f,
    fields: [
      {
        name: "Source",
        value: \`r/\${lead.subreddit ?? "unknown"}\`,
        inline: true,
      },
      {
        name: "Type",
        value: lead.opportunityType,
        inline: true,
      },
      {
        name: "Competition",
        value: \`\${lead.engagement.comments ?? 0} comments\`,
        inline: true,
      },
      {
        name: "Tech",
        value: lead.techStack.length
          ? lead.techStack.slice(0, 8).join(", ")
          : "Unknown",
        inline: false,
      },
      {
        name: "Why it matches",
        value: score.reasons.length
          ? score.reasons.slice(0, 5).join("\\n")
          : "No reasons provided",
        inline: false,
      },
      {
        name: "Concerns",
        value: score.concerns.length
          ? score.concerns.slice(0, 5).join("\\n")
          : "None",
        inline: false,
      },
    ],
    footer: {
      text: \`Reddit Hire Notifier • \${new Date().toLocaleString()}\`,
    },
  };
}

function buildDescription(lead: CanonicalLead, score: FinalLeadScore): string {
  const chunks: string[] = [];

  chunks.push(\`**Score:** \${Math.round(score.finalScore * 100)}%\`);

  if (lead.budget) {
    chunks.push(
      \`**Budget:** \${lead.budget.currency ?? ""} \${lead.budget.min ?? "?"}\${
        lead.budget.period ? \` / \${lead.budget.period}\` : ""
      }\`
    );
  }

  if (lead.contactMethod) {
    chunks.push(\`**Contact:** \${lead.contactMethod}\`);
  }

  if (lead.body) {
    chunks.push(\`**Post Preview:**\\n\${lead.body.slice(0, 700)}\`);
  }

  if (score.suggestedReply) {
    chunks.push(\`**Suggested Reply:**\\n\${score.suggestedReply.slice(0, 900)}\`);
  }

  return chunks.join("\\n\\n");
}


20. Discord Notifier
Create src/notifications/discord.ts.
import { CanonicalLead, FinalLeadScore } from "../leads/types";
import { buildDiscordEmbed } from "./templates";

export class DiscordNotifier {
  constructor(private readonly webhookUrl: string) {}

  async sendLead(lead: CanonicalLead, score: FinalLeadScore): Promise<void> {
    const embed = buildDiscordEmbed(lead, score);

    const res = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "Reddit Hire Notifier",
        embeds: [embed],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        \`Discord webhook failed: \${res.status} \${res.statusText} \${text}\`
      );
    }
  }
}


21. Main Application Orchestrator
Create src/index.ts.
import "dotenv/config";
import { RedditSource } from "./sources/reddit/reddit-source";
import { defaultSubreddits } from "./sources/reddit/subreddits";
import { canonicalizeRedditPost } from "./leads/canonicalize";
import { enrichLead } from "./leads/enrich";
import { scoreLeadHeuristically } from "./scoring/heuristic-score";
import { GemmaScorer } from "./scoring/gemma-score";
import { rankLead } from "./scoring/final-ranker";
import { DiscordNotifier } from "./notifications/discord";
import { createDatabase } from "./store/sqlite";
import { LeadRepository } from "./store/lead-repository";
import { CanonicalLead } from "./leads/types";

const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? 900000);
const minNotifyScore = Number(process.env.MIN_NOTIFY_SCORE ?? 0.72);

const databasePath =
  process.env.DATABASE_PATH ?? "./data/reddit-hire-notifier.sqlite";

const redditUserAgent =
  process.env.REDDIT_USER_AGENT ?? "reddit-hire-notifier/1.0";

const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!discordWebhookUrl) {
  throw new Error("DISCORD_WEBHOOK_URL is required");
}

const subreddits = process.env.REDDIT_SUBREDDITS
  ? process.env.REDDIT_SUBREDDITS.split(",").map((s) => s.trim())
  : defaultSubreddits;

const aiEnabled = process.env.AI_ENABLED === "true";

const db = createDatabase(databasePath);
const repo = new LeadRepository(db);

const reddit = new RedditSource(redditUserAgent);
const discord = new DiscordNotifier(discordWebhookUrl);

const gemma =
  aiEnabled && process.env.GEMMA_API_KEY
    ? new GemmaScorer(
        process.env.GEMMA_API_KEY,
        process.env.GEMMA_MODEL ?? "gemma-4-26b-a4b-it"
      )
    : undefined;

let running = false;
let shuttingDown = false;

async function runOnce() {
  if (running) {
    console.log("[app] Previous run still active, skipping");
    return;
  }

  running = true;

  try {
    console.log("[app] Starting Reddit scrape");

    const rawPosts = await reddit.fetchManySubreddits(subreddits, 25);

    console.log(\`[app] Fetched \${rawPosts.length} raw Reddit posts\`);

    const newLeads: CanonicalLead[] = [];

    for (const rawPost of rawPosts) {
      const canonical = canonicalizeRedditPost(rawPost);

      if (repo.hasLead(canonical.id, canonical.canonicalHash)) {
        continue;
      }

      const enriched = enrichLead(canonical);

      repo.insertLead(enriched);

      newLeads.push(enriched);
    }

    console.log(\`[app] New leads: \${newLeads.length}\`);

    const heuristicPassed: Array<{
      lead: CanonicalLead;
      heuristic: ReturnType<typeof scoreLeadHeuristically>;
    }> = [];

    for (const lead of newLeads) {
      const heuristic = scoreLeadHeuristically(lead);

      if (!heuristic.passed) {
        continue;
      }

      heuristicPassed.push({ lead, heuristic });
    }

    console.log(\`[app] Passed heuristic: \${heuristicPassed.length}\`);

    const aiScores =
      gemma && heuristicPassed.length > 0
        ? await scoreInBatches(
            gemma,
            heuristicPassed.map((item) => item.lead),
            8
          )
        : new Map();

    let notified = 0;

    for (const item of heuristicPassed) {
      const aiScore = aiScores.get(item.lead.id);
      const finalScore = rankLead(item.lead, item.heuristic, aiScore);

      repo.insertScore(finalScore);

      if (finalScore.finalScore >= minNotifyScore) {
        try {
          await discord.sendLead(item.lead, finalScore);
          repo.insertNotification(item.lead.id, "discord", "sent");
          notified += 1;

          // Discord rate safety.
          await sleep(1200);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          repo.insertNotification(
            item.lead.id,
            "discord",
            "failed",
            message
          );

          console.error("[discord] Failed to notify", message);
        }
      }
    }

    console.log(\`[app] Notified \${notified} leads\`);
  } catch (error) {
    console.error("[app] Run failed", error);
  } finally {
    running = false;
  }
}

async function scoreInBatches(
  scorer: GemmaScorer,
  leads: CanonicalLead[],
  batchSize: number
) {
  const allScores = new Map();

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);

    try {
      const scores = await scorer.scoreLeads(batch);

      for (const [leadId, score] of scores.entries()) {
        allScores.set(leadId, score);
      }
    } catch (error) {
      console.error("[gemma] Batch failed", error);
    }

    await sleep(1500);
  }

  return allScores;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await runOnce();

  const interval = setInterval(() => {
    if (!shuttingDown) {
      void runOnce();
    }
  }, pollIntervalMs);

  process.on("SIGINT", () => {
    console.log("[app] SIGINT received");
    shuttingDown = true;
    clearInterval(interval);
    db.close();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("[app] SIGTERM received");
    shuttingDown = true;
    clearInterval(interval);
    db.close();
    process.exit(0);
  });
}

void main();
