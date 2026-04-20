import axios from 'axios';
import { IGeminiClient } from '../types/interfaces';
import { RedditPost, GeminiResponse } from '../types';
import { GeminiRateLimiter } from './gemini-rate-limiter';

interface GenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export class GeminiClient implements IGeminiClient {
  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly rateLimiter: GeminiRateLimiter;

  constructor(apiKey: string, modelName?: string) {
    this.apiKey = apiKey;
    this.modelName = modelName || process.env.GEMINI_MODEL || 'gemma-4-26b-a4b-it';
    this.rateLimiter = new GeminiRateLimiter({
      requestsPerMinute: parseInt(
        process.env.GEMINI_REQUESTS_PER_MINUTE || '15',
        10
      ),
      burstCapacity: parseInt(process.env.GEMINI_BURST_CAPACITY || '5', 10),
    });
  }

  async scorePost(
    post: RedditPost,
    _correlationId: string
  ): Promise<GeminiResponse> {
    await this.rateLimiter.waitForToken();

    try {
      const response = await axios.post<GenerateContentResponse>(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent`,
        {
          contents: [
            {
              parts: [
                {
                  text: this.createPrompt(post),
                },
              ],
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          timeout: 30000,
        }
      );

      const generatedText = this.extractResponseText(response.data);
      if (!generatedText) {
        throw new Error('No response generated');
      }

      return this.parseGeminiResponse(generatedText);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Gemini scoring failed: ${errorMessage}`);
    }
  }

  async scoreBatch(
    posts: RedditPost[],
    correlationId: string
  ): Promise<Array<{ post: RedditPost; response: GeminiResponse }>> {
    const results: Array<{ post: RedditPost; response: GeminiResponse }> = [];

    for (const post of posts) {
      try {
        const response = await this.scorePost(post, correlationId);
        results.push({ post, response });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        results.push({
          post,
          response: {
            score: 0,
            reasoning: `Error: ${errorMessage}`,
          },
        });
      }
    }

    return results;
  }

  private extractResponseText(response: GenerateContentResponse): string {
    const parts =
      response.candidates?.flatMap((candidate) => candidate.content?.parts || []) ||
      [];

    return parts
      .map((part) => part.text?.trim())
      .filter((text): text is string => Boolean(text))
      .join('\n')
      .trim();
  }

  private createPrompt(post: RedditPost): string {
    return `
Analyze this Reddit post to determine if it's a legitimate hiring/freelance opportunity for developers:

Title: "${post.title}"
Author: u/${post.author}
Subreddit: r/${post.subreddit}
Score: ${post.score}
Job Link: "${post.url || post.permalink}"

Score from 0.0 to 1.0 how likely this is a genuine hiring post for developers/engineers.
Consider:
- Is it offering paid work?
- Does it mention specific technologies or skills?
- Does it seem legitimate (not spam or low-quality)?
- Is it clearly looking for developers/engineers?

IMPORTANT RULES:
- If the post contains "[For Hire]", "for hire", or similar phrases indicating someone offering their services, score it as 0.0
- Only score posts where someone is HIRING developers, not where developers are offering services
- If it is not a developer or programming job, score it as 0.0

Respond with only a number between 0.0 and 1.0.
`.trim();
  }

  private parseGeminiResponse(text: string): GeminiResponse {
    const match = text.match(/([0-9]*\.?[0-9]+)/);
    if (match && match[1]) {
      const score = parseFloat(match[1]);
      if (!Number.isNaN(score)) {
        const normalizedScore = score > 1 ? score / 100 : score;
        if (normalizedScore >= 0 && normalizedScore <= 1) {
          return {
            score: normalizedScore,
            reasoning: text,
          };
        }
      }
    }

    return {
      score: 0,
      reasoning: text,
    };
  }
}

export function createGeminiClient(): IGeminiClient | undefined {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return undefined;
  }

  return new GeminiClient(apiKey);
}
