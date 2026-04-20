import { INotifier, IHttpClient } from '../types/interfaces';
import { MatchResult, NotificationPayload, DiscordEmbed } from '../types';
import { RateLimiter } from './rate-limiter';

export class DiscordNotifier implements INotifier {
  private webhookUrl: string;
  private httpClient: IHttpClient;
  private rateLimitQueue: Promise<void> = Promise.resolve();
  private rateLimiter: RateLimiter;

  constructor(webhookUrl: string, httpClient: IHttpClient) {
    this.webhookUrl = webhookUrl;
    this.httpClient = httpClient;
    // 4 notifications per second (1000ms)
    this.rateLimiter = new RateLimiter(4, 1000);
  }

  async notify(match: MatchResult, correlationId: string): Promise<void> {
    // Wait for rate limit if needed
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      await this.sleep(waitTime);
    }

    // Queue notifications to respect rate limits
    this.rateLimitQueue = this.rateLimitQueue.then(() =>
      this.sendNotification(match, correlationId)
    );
    return this.rateLimitQueue;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async sendNotification(
    match: MatchResult,
    _correlationId: string
  ): Promise<void> {
    const payload = this.createDiscordPayload(match);

    try {
      // Record the request for rate limiting
      this.rateLimiter.recordRequest();

      const response = await this.httpClient.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        retries: 2,
      });

      if (response.status === 204) {
        // Success - Discord webhook returns 204 No Content
        return;
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Check if it's a rate limit error and implement backoff
      if (errorMessage.includes('429') || errorMessage.includes('rate')) {
        // Exponential backoff for rate limits
        await this.sleep(2000);
        throw error;
      }

      throw new Error(`Failed to send Discord notification: ${errorMessage}`);
    }
  }

  private createDiscordPayload(match: MatchResult): NotificationPayload {
    const {
      post,
      matchedKeywords,
      score,
      finalScore,
      decisionReasons,
      requiredSkills,
      employmentType,
      remoteType,
      budgetOrSalary,
    } = match;

    const embed: DiscordEmbed = {
      title: post.title,
      url: post.permalink,
      fields: [
        {
          name: 'Author',
          value: `u/${post.author}`,
          inline: true,
        },
        {
          name: 'Subreddit',
          value: `r/${post.subreddit}`,
          inline: true,
        },
        {
          name: 'Final Fit',
          value: (finalScore ?? score ?? 0).toFixed(2),
          inline: true,
        },
        {
          name: 'Reddit Score',
          value: post.score.toString(),
          inline: true,
        },
        {
          name: 'Matched Keywords',
          value: matchedKeywords.join(', '),
          inline: false,
        },
      ],
      timestamp: new Date(post.createdUtc * 1000).toISOString(),
      color: 0x00ff00, // Green color
    };

    // Add Gemini score if available
    if (score !== undefined) {
      embed.fields.push({
        name: 'AI Score',
        value: `${(score * 100).toFixed(1)}%`,
        inline: true,
      });
    }

    if (requiredSkills && requiredSkills.length > 0) {
      embed.fields.push({
        name: 'Required Skills',
        value: requiredSkills.join(', '),
        inline: false,
      });
    }

    if (decisionReasons && decisionReasons.length > 0) {
      embed.fields.push({
        name: 'Why Matched',
        value: decisionReasons.join('\n'),
        inline: false,
      });
    }

    if (employmentType && employmentType !== 'unspecified') {
      embed.fields.push({
        name: 'Employment',
        value: employmentType,
        inline: true,
      });
    }

    if (remoteType && remoteType !== 'unspecified') {
      embed.fields.push({
        name: 'Remote',
        value: remoteType,
        inline: true,
      });
    }

    if (budgetOrSalary && budgetOrSalary !== 'not specified') {
      embed.fields.push({
        name: 'Budget',
        value: budgetOrSalary,
        inline: true,
      });
    }

    // Add external URL if it's a link post
    if (post.url && post.url !== post.permalink) {
      embed.fields.push({
        name: 'Link',
        value: post.url,
        inline: false,
      });
    }

    return {
      username: 'reddit-hire-notifier',
      embeds: [embed],
    };
  }
}
