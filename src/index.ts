import 'dotenv/config';
import { RedditSource } from './sources/reddit/reddit-source';
import { defaultSubreddits } from './sources/reddit/subreddits';
import { canonicalizeRedditPost } from './leads/canonicalize';
import { enrichLead } from './leads/enrich';
import { scoreLeadHeuristically } from './scoring/heuristic-score';
import {
  formatNvidiaKimiError,
  NvidiaKimiScorer,
} from './scoring/nvidia-kimi-score';
import { rankLead } from './scoring/final-ranker';
import { DiscordNotifier } from './notifications/discord';
import { createDatabase } from './store/sqlite';
import { LeadRepository } from './store/lead-repository';
import { AiLeadScore, CanonicalLead } from './leads/types';

const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? 900000);
const minNotifyScore = Number(process.env.MIN_NOTIFY_SCORE ?? 0.72);

const databasePath =
  process.env.DATABASE_PATH ?? './data/reddit-hire-notifier.sqlite';

const redditUserAgent =
  process.env.REDDIT_USER_AGENT ?? 'reddit-hire-notifier/1.0';

const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!discordWebhookUrl) {
  throw new Error('DISCORD_WEBHOOK_URL is required');
}

const subreddits = process.env.REDDIT_SUBREDDITS
  ? process.env.REDDIT_SUBREDDITS.split(',').map((s) => s.trim())
  : defaultSubreddits;

const aiEnabled = process.env.AI_ENABLED === 'true';
const nvidiaApiKey = process.env.NVIDIA_API_KEY;

const db = createDatabase(databasePath);
const repo = new LeadRepository(db);

const reddit = new RedditSource(redditUserAgent);
const discord = new DiscordNotifier(discordWebhookUrl);

const aiScorer = aiEnabled
  ? new NvidiaKimiScorer(
      requireEnv('NVIDIA_API_KEY', nvidiaApiKey),
      process.env.NVIDIA_MODEL ?? 'moonshotai/kimi-k2.6'
    )
  : undefined;

let running = false;
let shuttingDown = false;

async function runOnce() {
  if (running) {
    console.log('[app] Previous run still active, skipping');
    return;
  }

  running = true;

  try {
    console.log('[app] Starting Reddit scrape');

    const rawPosts = await reddit.fetchManySubreddits(subreddits, 25);

    console.log(`[app] Fetched ${rawPosts.length} raw Reddit posts`);

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

    console.log(`[app] New leads: ${newLeads.length}`);

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

    console.log(`[app] Passed heuristic: ${heuristicPassed.length}`);

    const aiScores =
      aiScorer && heuristicPassed.length > 0
        ? await scoreInBatches(
            aiScorer,
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
          repo.insertNotification(item.lead.id, 'discord', 'sent');
          notified += 1;

          // Discord rate safety.
          await sleep(1200);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          repo.insertNotification(item.lead.id, 'discord', 'failed', message);

          console.error('[discord] Failed to notify', message);
        }
      }
    }

    console.log(`[app] Notified ${notified} leads`);
  } catch (error) {
    console.error('[app] Run failed', error);
  } finally {
    running = false;
  }
}

async function scoreInBatches(
  scorer: {
    scoreLeads(leads: CanonicalLead[]): Promise<Map<string, AiLeadScore>>;
  },
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
      console.error('[kimi] Batch failed', formatNvidiaKimiError(error));
    }

    await sleep(1500);
  }

  return allScores;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required when AI_ENABLED=true`);
  }

  return value;
}

async function main() {
  await runOnce();

  const interval = setInterval(() => {
    if (!shuttingDown) {
      void runOnce();
    }
  }, pollIntervalMs);

  process.on('SIGINT', () => {
    console.log('[app] SIGINT received');
    shuttingDown = true;
    clearInterval(interval);
    db.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('[app] SIGTERM received');
    shuttingDown = true;
    clearInterval(interval);
    db.close();
    process.exit(0);
  });
}

void main();
