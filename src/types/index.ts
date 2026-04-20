export interface RedditPost {
  id: string;
  title: string;
  body?: string | undefined;
  flair?: string | undefined;
  author: string;
  permalink: string;
  subreddit: string;
  score: number;
  createdUtc: number;
  commentsCount?: number | undefined;
  url?: string | undefined;
  outboundDomain?: string | undefined;
}

export interface Profile {
  profileVersion: string;
  targetRoles: string[];
  coreSkills: string[];
  niceToHave: string[];
  avoid: string[];
  employmentPreferences: string[];
  locationPreference: string;
  seniorityTarget: string;
  minimumBudgetOrSalary?: string | null | undefined;
}

export interface CanonicalOpportunity {
  postId: string;
  subreddit: string;
  title: string;
  body: string;
  flair: string;
  author: string;
  permalink: string;
  outboundUrl?: string | undefined;
  outboundDomain: string;
  createdAt: string;
  redditScore: number;
  commentsCount: number;
}

export interface RuleFilterResult {
  passesRules: boolean;
  rejectReasons: string[];
  positiveSignals: string[];
}

export interface OpportunityFacts {
  isJob: boolean;
  roleLabels: string[];
  requiredSkills: string[];
  optionalSkills: string[];
  employmentType: string;
  remoteType: string;
  locationConstraint: string;
  budgetOrSalary: string;
  confidence: number;
  reasonsForFit: string[];
  reasonsAgainstFit: string[];
}

export interface MatchResult {
  post: RedditPost;
  matchedKeywords: string[];
  score?: number | undefined;
  finalScore?: number | undefined;
  decision?: 'notify_immediately' | 'digest' | 'reject' | undefined;
  decisionReasons?: string[] | undefined;
  requiredSkills?: string[] | undefined;
  employmentType?: string | undefined;
  remoteType?: string | undefined;
  locationConstraint?: string | undefined;
  budgetOrSalary?: string | undefined;
  profileVersion?: string | undefined;
  positiveSignals?: string[] | undefined;
  rejectReasons?: string[] | undefined;
}

export interface ScrapingResult {
  posts: RedditPost[];
  correlationId: string;
  timestamp: number;
}

export interface NotificationPayload {
  username: string;
  embeds: DiscordEmbed[];
}

export interface DiscordEmbed {
  title: string;
  url: string;
  fields: DiscordField[];
  timestamp: string;
  color?: number;
}

export interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface Config {
  subreddits: string[];
  keywords: string[];
  regexPatterns?: string[] | undefined;
  pollIntervalMs: number;
  maxRetries: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  geminiThreshold?: number | undefined;
  storeType: 'memory' | 'sqlite' | 'mongodb';
  sqlitePath?: string | undefined;
  mongodbUri?: string | undefined;
  discordWebhookUrl?: string | undefined;
  telegramBotToken?: string | undefined;
  telegramChatId?: string | undefined;
  userAgent: string;
  httpProxy?: string | undefined;
  metricsEnabled: boolean;
  port: number;
  logLevel: string;
  logPretty: boolean;
}

export interface Metrics {
  scrapes: number;
  matches: number;
  notifications: number;
  errors: number;
  lastScrapeTime?: number;
}

export interface GeminiResponse {
  score: number;
  reasoning?: string;
}

export interface HttpClientOptions {
  userAgent: string;
  proxy?: string | undefined;
  maxRetries: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

export interface HttpResponse {
  data: string;
  status: number;
  headers: Record<string, string>;
}

export interface RequestOptions {
  headers?: Record<string, string> | undefined;
  timeout?: number | undefined;
  retries?: number | undefined;
}
