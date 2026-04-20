/**
 * Batch processor for Reddit posts
 * Accumulates posts and processes them in batches for efficiency
 */

import { RedditPost, MatchResult } from '../types';
import { IGeminiClient } from '../types/interfaces';
import { defaultProfile } from '../config/profile';
import {
  applyRuleFilter,
  buildCanonicalOpportunity,
  extractOpportunityFacts,
  rankOpportunity,
} from './opportunity';

export interface BatchProcessorConfig {
  batchSize: number;
  batchTimeoutMs: number;
  threshold: number;
}

export interface BatchedPost {
  post: RedditPost;
  score: number;
  reasoning: string;
}

export class BatchProcessor {
  private pendingPosts: RedditPost[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly config: BatchProcessorConfig;
  private readonly aiClient: IGeminiClient | undefined;
  private readonly keywords: string[];

  constructor(
    config: BatchProcessorConfig,
    aiClient?: IGeminiClient,
    keywords: string[] = []
  ) {
    this.config = config;
    this.aiClient = aiClient;
    this.keywords = keywords;
  }

  /**
   * Add posts to the batch queue
   */
  async addPosts(
    posts: RedditPost[],
    correlationId: string
  ): Promise<MatchResult[]> {
    // Filter posts by keywords first
    const keywordMatches = this.filterByKeywords(posts);

    if (keywordMatches.length === 0) {
      return [];
    }

    // If no AI client, use the deterministic MVP ranking path directly
    if (!this.aiClient) {
      return keywordMatches
        .map((post) => this.buildMatchResult(post))
        .filter((item): item is MatchResult => Boolean(item))
        .filter(
          (item) =>
            item.decision === 'notify_immediately' &&
            (item.finalScore ?? 0) >= this.config.threshold
        );
    }

    // Add to pending batch
    this.pendingPosts.push(...keywordMatches);

    // Process batch if it's full or start timer for partial batch
    if (this.pendingPosts.length >= this.config.batchSize) {
      return await this.processBatch(correlationId);
    } else {
      this.startBatchTimer(correlationId);
      return [];
    }
  }

  /**
   * Force process any pending posts
   */
  async flush(correlationId: string): Promise<MatchResult[]> {
    if (this.pendingPosts.length === 0) {
      return [];
    }

    this.clearBatchTimer();
    return await this.processBatch(correlationId);
  }

  /**
   * Filter posts by keywords
   */
  private filterByKeywords(posts: RedditPost[]): RedditPost[] {
    if (this.keywords.length === 0) {
      return posts;
    }

    return posts.filter((post) => {
      const text = [
        post.title,
        post.body || '',
        post.flair || '',
        post.author,
        post.outboundDomain || '',
      ]
        .join(' ')
        .toLowerCase();
      return this.keywords.some((keyword) =>
        text.includes(keyword.toLowerCase())
      );
    });
  }

  /**
   * Get matched keywords for a post
   */
  private getMatchedKeywords(post: RedditPost): string[] {
    const text = [
      post.title,
      post.body || '',
      post.flair || '',
      post.author,
      post.outboundDomain || '',
    ]
      .join(' ')
      .toLowerCase();
    return this.keywords.filter((keyword) =>
      text.includes(keyword.toLowerCase())
    );
  }

  /**
   * Process current batch of posts
   */
  private async processBatch(correlationId: string): Promise<MatchResult[]> {
    if (this.pendingPosts.length === 0) {
      return [];
    }

    const batchToProcess = [...this.pendingPosts];
    this.pendingPosts = [];
    this.clearBatchTimer();

    try {
      const scoredPosts = this.aiClient
        ? await this.aiClient.scoreBatch(batchToProcess, correlationId)
        : batchToProcess.map((post) => ({
            post,
            response: {
              score: 0.8,
              reasoning: 'Keyword and rule based fallback',
            },
          }));

      return scoredPosts
        .map((item) => this.buildMatchResult(item.post, item.response.score))
        .filter((item): item is MatchResult => Boolean(item))
        .filter(
          (item) =>
            item.decision === 'notify_immediately' &&
            (item.finalScore ?? 0) >= this.config.threshold
        );
    } catch (error) {
      return batchToProcess
        .map((post) => this.buildMatchResult(post))
        .filter((item): item is MatchResult => Boolean(item))
        .filter(
          (item) =>
            item.decision === 'notify_immediately' &&
            (item.finalScore ?? 0) >= this.config.threshold
        );
    }
  }

  /**
   * Start timer for batch timeout
   */
  private startBatchTimer(correlationId: string): void {
    if (this.batchTimer) {
      return;
    }

    this.batchTimer = setTimeout(async () => {
      await this.processBatch(correlationId);
    }, this.config.batchTimeoutMs);
  }

  /**
   * Clear the batch timer
   */
  private clearBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clearBatchTimer();
    this.pendingPosts = [];
  }

  private buildMatchResult(
    post: RedditPost,
    aiScore?: number
  ): MatchResult | null {
    const canonicalOpportunity = buildCanonicalOpportunity(post);
    const rules = applyRuleFilter(canonicalOpportunity, defaultProfile);

    if (!rules.passesRules) {
      return null;
    }

    const facts = extractOpportunityFacts(canonicalOpportunity, defaultProfile);

    if (!facts.isJob) {
      return null;
    }

    const ranking = rankOpportunity(
      canonicalOpportunity,
      facts,
      rules,
      defaultProfile,
      aiScore
    );

    if (ranking.decision === 'reject') {
      return null;
    }

    return {
      post,
      matchedKeywords: this.getMatchedKeywords(post),
      score: aiScore,
      finalScore: ranking.finalScore,
      decision: ranking.decision,
      decisionReasons: ranking.decisionReasons,
      requiredSkills: facts.requiredSkills,
      employmentType: facts.employmentType,
      remoteType: facts.remoteType,
      locationConstraint: facts.locationConstraint,
      budgetOrSalary: facts.budgetOrSalary,
      profileVersion: defaultProfile.profileVersion,
      positiveSignals: rules.positiveSignals,
      rejectReasons: rules.rejectReasons,
    };
  }
}
