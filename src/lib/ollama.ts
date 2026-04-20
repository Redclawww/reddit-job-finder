import axios from 'axios';
import { IGeminiClient } from '../types/interfaces';
import { RedditPost, GeminiResponse } from '../types';

export class OllamaClient implements IGeminiClient {
  private baseUrl: string;
  private model: string;

  constructor(
    baseUrl: string = 'http://localhost:11434',
    model: string = 'llama3.2'
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async scorePost(
    post: RedditPost,
    _correlationId: string
  ): Promise<GeminiResponse> {
    const prompt = this.createPrompt(post);

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 100,
          },
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data && response.data.response) {
        const generatedText = response.data.response;
        return this.parseOllamaResponse(generatedText);
      } else {
        throw new Error('No response from Ollama');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Ollama scoring failed: ${errorMessage}`);
    }
  }

  /**
   * Score multiple posts in a batch
   */
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
        // Log error but continue with other posts
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // Add default low score for failed posts
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

  private createPrompt(post: RedditPost): string {
    return `
Analyze this Reddit post to determine if it's a legitimate hiring/freelance opportunity for developers:

Title: "${post.title}"
Author: u/${post.author}
Subreddit: r/${post.subreddit}
Score: ${post.score}

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

  private parseOllamaResponse(text: string): GeminiResponse {
    try {
      // Clean up the response text
      const cleanText = text.trim();

      // Look for the SCORE|REASON format
      const match = cleanText.match(/^(\d+\.?\d*)\s*\|\s*(.+)$/m);

      if (match && match[1] && match[2]) {
        const score = parseFloat(match[1]);
        const reasoning = match[2].trim();

        if (!isNaN(score) && score >= 0 && score <= 1) {
          return {
            score,
            reasoning,
          };
        }
      }

      // Fallback: try to extract just a number
      const numberMatch = cleanText.match(/(\d+\.?\d*)/);
      if (numberMatch && numberMatch[1]) {
        const score = parseFloat(numberMatch[1]);
        if (!isNaN(score)) {
          // If score is > 1, assume it's a percentage and convert
          const normalizedScore = score > 1 ? score / 100 : score;
          if (normalizedScore >= 0 && normalizedScore <= 1) {
            return {
              score: normalizedScore,
              reasoning: 'Extracted from Ollama response',
            };
          }
        }
      }

      // If we can't parse a score, return a low score
      return {
        score: 0.1,
        reasoning: `Could not parse Ollama response: "${cleanText}"`,
      };
    } catch (error) {
      return {
        score: 0.1,
        reasoning: 'Error parsing Ollama response',
      };
    }
  }
}

export function createOllamaClient(): IGeminiClient | undefined {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2';

  // Check if Ollama is enabled
  if (process.env.USE_OLLAMA === 'true') {
    return new OllamaClient(ollamaUrl, ollamaModel);
  }

  return undefined;
}
