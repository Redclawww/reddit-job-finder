import { z } from 'zod';

export const configSchema = z
  .object({
    subreddits: z.array(z.string()).min(1),
    keywords: z.array(z.string()).min(1),
    regexPatterns: z.array(z.string()).optional(),
    pollIntervalMs: z.number().min(1000).max(300000), // 1 second to 5 minutes
    maxRetries: z.number().min(1).max(10),
    backoffMultiplier: z.number().min(1).max(5),
    maxBackoffMs: z.number().min(1000).max(300000),
    geminiThreshold: z.number().min(0).max(1).optional(),
    storeType: z.enum(['memory', 'sqlite', 'mongodb']),
    sqlitePath: z.string().optional(),
    mongodbUri: z.string().optional(),
    discordWebhookUrl: z.string().url().optional(),
    telegramBotToken: z.string().min(1).optional(),
    telegramChatId: z.string().min(1).optional(),
    userAgent: z.string().min(1),
    httpProxy: z.string().optional(),
    metricsEnabled: z.boolean(),
    port: z.number().min(1).max(65535),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']),
    logPretty: z.boolean(),
  })
  .refine(
    (cfg) =>
      Boolean(cfg.discordWebhookUrl) ||
      Boolean(cfg.telegramBotToken && cfg.telegramChatId),
    {
      message:
        'At least one notifier must be configured: DISCORD_WEBHOOK_URL or both TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID',
    }
  );

export type ConfigSchema = z.infer<typeof configSchema>;
