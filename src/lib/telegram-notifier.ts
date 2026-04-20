import { INotifier, IHttpClient } from '../types/interfaces';
import { MatchResult } from '../types';
import { RateLimiter } from './rate-limiter';

interface TelegramSendMessagePayload {
  chat_id: string;
  text: string;
  disable_web_page_preview: boolean;
}

export class TelegramNotifier implements INotifier {
  private botToken: string;
  private chatId: string;
  private httpClient: IHttpClient;
  private rateLimitQueue: Promise<void> = Promise.resolve();
  private rateLimiter: RateLimiter;

  constructor(botToken: string, chatId: string, httpClient: IHttpClient) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.httpClient = httpClient;
    // Keep Telegram requests conservative to avoid burst limits.
    this.rateLimiter = new RateLimiter(1, 1000);
  }

  async notify(match: MatchResult, correlationId: string): Promise<void> {
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      await this.sleep(waitTime);
    }

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
    const payload = this.createPayload(match);
    const endpoint = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      this.rateLimiter.recordRequest();

      const response = await this.httpClient.post(endpoint, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        retries: 2,
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to send Telegram notification: ${errorMessage}`);
    }
  }

  private createPayload(match: MatchResult): TelegramSendMessagePayload {
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
    const jobLink = post.url || post.permalink;
    const lines = [
      `Strong Match: ${(finalScore ?? score ?? 0).toFixed(2)}`,
      `Title: ${post.title}`,
      `Subreddit: r/${post.subreddit}`,
      `Author: u/${post.author}`,
      `Post Score: ${post.score}`,
      `Matched: ${matchedKeywords.join(', ')}`,
      ...(requiredSkills && requiredSkills.length > 0
        ? [`Required skills: ${requiredSkills.join(', ')}`]
        : []),
      ...(decisionReasons && decisionReasons.length > 0
        ? ['Why matched:', ...decisionReasons.map((reason) => `- ${reason}`)]
        : []),
      ...(employmentType && employmentType !== 'unspecified'
        ? [`Employment: ${employmentType}`]
        : []),
      ...(remoteType && remoteType !== 'unspecified'
        ? [`Remote: ${remoteType}`]
        : []),
      ...(budgetOrSalary && budgetOrSalary !== 'not specified'
        ? [`Budget: ${budgetOrSalary}`]
        : []),
      ...(score !== undefined
        ? [`AI Score: ${(score * 100).toFixed(1)}%`]
        : []),
      `Job Link: ${jobLink}`,
      ...(jobLink !== post.permalink ? [`Reddit Link: ${post.permalink}`] : []),
    ];

    return {
      chat_id: this.chatId,
      text: lines.join('\n'),
      disable_web_page_preview: false,
    };
  }
}
