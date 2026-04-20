import { IMatcher, IGeminiClient } from '../types/interfaces';
import { RedditPost, MatchResult } from '../types';

export class PostMatcher implements IMatcher {
  private keywords: string[];
  private regexPatterns: RegExp[];
  private geminiClient: IGeminiClient | undefined;
  private geminiThreshold: number;

  constructor(
    keywords: string[],
    regexPatterns: string[] = [],
    geminiClient?: IGeminiClient,
    geminiThreshold: number = 0.7
  ) {
    this.keywords = keywords.map((k) => k.toLowerCase());
    this.regexPatterns = regexPatterns.map(
      (pattern) => new RegExp(pattern, 'gi')
    );
    this.geminiClient = geminiClient;
    this.geminiThreshold = geminiThreshold;
  }

  async findMatches(
    posts: RedditPost[],
    correlationId: string
  ): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];

    for (const post of posts) {
      const keywordMatches = this.findKeywordMatches(post);

      if (keywordMatches.length > 0) {
        let shouldNotify = true;
        let score: number | undefined;

        // If Gemini is enabled, use it as a second-pass filter
        if (this.geminiClient) {
          try {
            const geminiResponse = await this.geminiClient.scorePost(
              post,
              correlationId
            );
            score = geminiResponse.score;
            shouldNotify = score >= this.geminiThreshold;

            console.log(
              `Gemini scored post "${post.title}" with ${score} (threshold: ${this.geminiThreshold})`
            );
          } catch (error) {
            console.warn(
              'Gemini scoring failed, falling back to keyword matching:',
              error
            );
            // Fall back to keyword matching
          }
        }

        if (shouldNotify) {
          const match: MatchResult = {
            post,
            matchedKeywords: keywordMatches,
          };

          if (score !== undefined) {
            match.score = score;
          }

          matches.push(match);
        }
      }
    }

    return matches;
  }

  private findKeywordMatches(post: RedditPost): string[] {
    const text = `${post.title} ${post.author}`.toLowerCase();
    const matchedKeywords: string[] = [];

    // Check keyword matches
    for (const keyword of this.keywords) {
      if (text.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    // Check regex matches
    for (const regex of this.regexPatterns) {
      const matches = text.match(regex);
      if (matches) {
        matchedKeywords.push(...matches);
      }
    }

    // Remove duplicates
    return [...new Set(matchedKeywords)];
  }
}
