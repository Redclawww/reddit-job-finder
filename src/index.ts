import dotenv from 'dotenv';
import { RedditScraper } from './lib/scraper';
import { DiscordNotifier } from './lib/notifier';
import { TelegramNotifier } from './lib/telegram-notifier';
import { HttpClient } from './lib/http-client';
import { MemoryStore } from './lib/store/memory-store';
import { SqliteStore } from './lib/store/sqlite-store';
import { BatchProcessor } from './lib/batch-processor';
import { createGeminiClient } from './lib/gemini';
import { INotifier, IStore } from './types/interfaces';
import { Config } from './types';
import { defaultConfig } from './config/defaults';
import { configSchema } from './config/schema';
import express from 'express';

dotenv.config();

class RedditHireNotifier {
  private config: Config;
  private scraper: RedditScraper;
  private batchProcessor: BatchProcessor;
  private notifiers: Array<{ name: string; notifier: INotifier }> = [];
  private store: IStore;
  private httpClient: HttpClient;
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private metrics = {
    scrapes: 0,
    matches: 0,
    notifications: 0,
    errors: 0,
    lastScrapeTime: undefined as number | undefined,
  };

  constructor(config: Partial<Config>) {
    this.config = this.validateConfig(config);
    const httpClientOptions = {
      userAgent: this.config.userAgent,
      maxRetries: this.config.maxRetries,
      backoffMultiplier: this.config.backoffMultiplier,
      maxBackoffMs: this.config.maxBackoffMs,
      ...(this.config.httpProxy && { proxy: this.config.httpProxy }),
    };

    this.httpClient = new HttpClient(httpClientOptions);

    this.scraper = new RedditScraper(httpClientOptions);

    const geminiClient = createGeminiClient();

    // Create batch processor instead of matcher
    this.batchProcessor = new BatchProcessor(
      {
        batchSize: 20, // Process up to 20 posts at once
        batchTimeoutMs: 30000, // 30 second timeout for partial batches
        threshold: this.config.geminiThreshold || 0.7,
      },
      geminiClient,
      this.config.keywords
    );

    if (this.config.discordWebhookUrl) {
      this.notifiers.push({
        name: 'discord',
        notifier: new DiscordNotifier(
          this.config.discordWebhookUrl,
          this.httpClient
        ),
      });
    }

    if (this.config.telegramBotToken && this.config.telegramChatId) {
      this.notifiers.push({
        name: 'telegram',
        notifier: new TelegramNotifier(
          this.config.telegramBotToken,
          this.config.telegramChatId,
          this.httpClient
        ),
      });
    }

    if (this.notifiers.length === 0) {
      throw new Error(
        'No notification channel configured. Set DISCORD_WEBHOOK_URL or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.'
      );
    }

    this.store = this.createStore();
  }

  private validateConfig(config: Partial<Config>): Config {
    const mergedConfig = { ...defaultConfig, ...config };
    const result = configSchema.safeParse(mergedConfig);

    if (!result.success) {
      throw new Error(`Invalid configuration: ${result.error.message}`);
    }

    return result.data;
  }

  private createStore(): IStore {
    switch (this.config.storeType) {
      case 'memory':
        return new MemoryStore();
      case 'sqlite':
        return new SqliteStore(this.config.sqlitePath);
      case 'mongodb':
        throw new Error('MongoDB store not implemented yet');
      default:
        throw new Error(`Unknown store type: ${this.config.storeType}`);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Notifier is already running');
      return;
    }

    console.log('Starting Reddit Hire Notifier...');
    console.log(`Monitoring subreddits: ${this.config.subreddits.join(', ')}`);
    console.log(`Poll interval: ${this.config.pollIntervalMs}ms`);
    console.log(`Store type: ${this.config.storeType}`);
    console.log(
      `Notification channels: ${this.notifiers.map((x) => x.name).join(', ')}`
    );

    // Initialize store if needed
    if ('init' in this.store && typeof this.store.init === 'function') {
      await this.store.init();
    }

    this.isRunning = true;

    // Start metrics server if enabled
    if (this.config.metricsEnabled) {
      this.startMetricsServer();
    }

    // Schedule polling
    this.scheduleNextPoll();

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  async runOnce(): Promise<void> {
    console.log('Running single scrape cycle...');
    try {
      await this.pollSubreddits();
    } finally {
      await this.cleanupResources();
    }
  }

  private scheduleNextPoll(): void {
    if (!this.isRunning) return;

    this.pollTimer = setTimeout(async () => {
      try {
        await this.pollSubreddits();
      } catch (error) {
        this.metrics.errors++;
        console.error('Error during polling:', error);
      }

      this.scheduleNextPoll();
    }, this.config.pollIntervalMs);
  }

  private async pollSubreddits(): Promise<void> {
    const correlationId = this.generateCorrelationId();

    const startTime = Date.now();
    let totalMatches = 0;

    // Collect all new posts from all subreddits
    const allNewPosts = [];

    for (const subreddit of this.config.subreddits) {
      try {
        // Scrape posts
        const posts = await this.scraper.scrapeSubreddit(
          subreddit,
          correlationId
        );

        // Filter out already seen posts
        const newPosts = [];
        for (const post of posts) {
          const seen = await this.store.hasSeen(post.id);
          if (!seen) {
            newPosts.push(post);
            await this.store.markSeen(post.id);
          }
        }

        allNewPosts.push(...newPosts);
      } catch (error) {
        this.metrics.errors++;
        // Continue with other subreddits on error
      }

      // Add a small delay between requests to avoid rate limiting
      if (
        subreddit !== this.config.subreddits[this.config.subreddits.length - 1]
      ) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    this.metrics.scrapes++;

    if (allNewPosts.length > 0) {
      try {
        // Process all posts in batches using the batch processor
        const matches = await this.batchProcessor.addPosts(
          allNewPosts,
          correlationId
        );

        totalMatches += matches.length;

        // Send notifications for all matches
        for (const match of matches) {
          for (const channel of this.notifiers) {
            try {
              await channel.notifier.notify(match, correlationId);
              this.metrics.notifications++;
            } catch (error) {
              // Continue with other notifications on error
            }
          }
        }

        // Process any remaining batches
        const remainingMatches = await this.batchProcessor.flush(correlationId);
        totalMatches += remainingMatches.length;

        for (const match of remainingMatches) {
          for (const channel of this.notifiers) {
            try {
              await channel.notifier.notify(match, correlationId);
              this.metrics.notifications++;
            } catch (error) {
              // Continue with other notifications on error
            }
          }
        }
      } catch (error) {
        this.metrics.errors++;
      }
    }

    this.metrics.matches += totalMatches;
    this.metrics.lastScrapeTime = startTime;
  }

  private generateCorrelationId(): string {
    return `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startMetricsServer(): void {
    const app = express();

    app.get('/metrics', (_req, res) => {
      const metricsText = `
# HELP reddit_scrapes_total Total number of scrape cycles
# TYPE reddit_scrapes_total counter
reddit_scrapes_total ${this.metrics.scrapes}

# HELP reddit_matches_total Total number of matching posts found
# TYPE reddit_matches_total counter
reddit_matches_total ${this.metrics.matches}

# HELP reddit_notifications_total Total number of notifications sent
# TYPE reddit_notifications_total counter
reddit_notifications_total ${this.metrics.notifications}

# HELP reddit_errors_total Total number of errors encountered
# TYPE reddit_errors_total counter
reddit_errors_total ${this.metrics.errors}

# HELP reddit_last_scrape_timestamp Unix timestamp of last scrape
# TYPE reddit_last_scrape_timestamp gauge
reddit_last_scrape_timestamp ${this.metrics.lastScrapeTime || 0}
`.trim();

      res.set('Content-Type', 'text/plain');
      res.send(metricsText);
    });

    app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        running: this.isRunning,
        uptime: process.uptime(),
        metrics: this.metrics,
      });
    });

    app.listen(this.config.port, () => {
      console.log(`Metrics server running on port ${this.config.port}`);
    });
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Reddit Hire Notifier...');
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    await this.cleanupResources();

    console.log('Shutdown complete');
    process.exit(0);
  }

  private async cleanupResources(): Promise<void> {
    if (this.batchProcessor.cleanup) {
      this.batchProcessor.cleanup();
    }

    if (
      this.scraper &&
      'close' in this.scraper &&
      typeof this.scraper.close === 'function'
    ) {
      await this.scraper.close();
    }

    if (this.store.cleanup) {
      await this.store.cleanup();
    }

    if ('close' in this.store && typeof this.store.close === 'function') {
      await this.store.close();
    }
  }
}

// Load configuration from environment variables
function loadConfigFromEnv(): Partial<Config> {
  const envConfig: Partial<Config> = {};

  if (process.env.DISCORD_WEBHOOK_URL) {
    envConfig.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    envConfig.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  }

  if (process.env.TELEGRAM_CHAT_ID) {
    envConfig.telegramChatId = process.env.TELEGRAM_CHAT_ID;
  }

  if (process.env.STORE_TYPE) {
    envConfig.storeType = process.env.STORE_TYPE as
      | 'memory'
      | 'sqlite'
      | 'mongodb';
  }

  if (process.env.SQLITE_PATH) {
    envConfig.sqlitePath = process.env.SQLITE_PATH;
  }

  if (process.env.MONGODB_URI) {
    envConfig.mongodbUri = process.env.MONGODB_URI;
  }

  if (process.env.GEMINI_API_KEY) {
    // We'll set this in the Gemini client, but track that it's available
  }

  if (process.env.GEMINI_THRESHOLD) {
    envConfig.geminiThreshold = parseFloat(process.env.GEMINI_THRESHOLD);
  }

  if (process.env.POLL_INTERVAL_MS) {
    envConfig.pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS);
  }

  if (process.env.MAX_RETRIES) {
    envConfig.maxRetries = parseInt(process.env.MAX_RETRIES);
  }

  if (process.env.BACKOFF_MULTIPLIER) {
    envConfig.backoffMultiplier = parseFloat(process.env.BACKOFF_MULTIPLIER);
  }

  if (process.env.MAX_BACKOFF_MS) {
    envConfig.maxBackoffMs = parseInt(process.env.MAX_BACKOFF_MS);
  }

  if (process.env.USER_AGENT) {
    envConfig.userAgent = process.env.USER_AGENT;
  }

  if (process.env.HTTP_PROXY) {
    envConfig.httpProxy = process.env.HTTP_PROXY;
  }

  if (process.env.PORT) {
    envConfig.port = parseInt(process.env.PORT);
  }

  if (process.env.METRICS_ENABLED) {
    envConfig.metricsEnabled = process.env.METRICS_ENABLED === 'true';
  }

  if (process.env.LOG_LEVEL) {
    envConfig.logLevel = process.env.LOG_LEVEL;
  }

  if (process.env.LOG_PRETTY) {
    envConfig.logPretty = process.env.LOG_PRETTY === 'true';
  }

  return envConfig;
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  try {
    const notifier = new RedditHireNotifier(loadConfigFromEnv());

    if (args.includes('--once')) {
      await notifier.runOnce();
    } else {
      await notifier.start();
    }
  } catch (error) {
    console.error('Failed to start notifier:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { RedditHireNotifier };
export default RedditHireNotifier;
