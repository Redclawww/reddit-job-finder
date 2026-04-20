import { PostMatcher } from '../../src/lib/matcher';
import { GeminiResponse, RedditPost, MatchResult } from '../../src/types';
import { IGeminiClient } from '../../src/types/interfaces';

// Mock Gemini client
class MockGeminiClient implements IGeminiClient {
  private scores: Map<string, number> = new Map();

  setScore(postId: string, score: number): void {
    this.scores.set(postId, score);
  }

  async scorePost(
    post: RedditPost,
    _correlationId: string
  ): Promise<{ score: number; reasoning?: string }> {
    const score = this.scores.get(post.id) ?? 0.5;
    return { score, reasoning: `Mock score for ${post.id}` };
  }

  async scoreBatch(
    posts: RedditPost[],
    correlationId: string
  ): Promise<Array<{ post: RedditPost; response: GeminiResponse }>> {
    const results: Array<{ post: RedditPost; response: GeminiResponse }> = [];

    for (const post of posts) {
      results.push({
        post,
        response: await this.scorePost(post, correlationId),
      });
    }

    return results;
  }
}

describe('PostMatcher', () => {
  let matcher: PostMatcher;
  let mockGeminiClient: MockGeminiClient;

  const samplePosts: RedditPost[] = [
    {
      id: 'hiring_post',
      title: '[Hiring] React Developer for startup',
      author: 'startup_ceo',
      permalink: '/r/forhire/comments/hiring_post/',
      subreddit: 'forhire',
      score: 50,
      createdUtc: Date.now() / 1000,
    },
    {
      id: 'freelance_post',
      title: 'Looking for freelance Next.js developer',
      author: 'client123',
      permalink: '/r/forhire/comments/freelance_post/',
      subreddit: 'forhire',
      score: 25,
      createdUtc: Date.now() / 1000,
    },
    {
      id: 'unrelated_post',
      title: 'Selling my old computer',
      author: 'seller',
      permalink: '/r/forhire/comments/unrelated_post/',
      subreddit: 'forhire',
      score: 5,
      createdUtc: Date.now() / 1000,
    },
  ];

  beforeEach(() => {
    mockGeminiClient = new MockGeminiClient();
    matcher = new PostMatcher(
      ['hiring', 'developer', 'freelance', 'react', 'next.js'],
      ['looking\\s+for\\s+.*(dev|developer)', 'hiring.*developer'],
      mockGeminiClient,
      0.7
    );
  });

  describe('findMatches without Gemini', () => {
    beforeEach(() => {
      matcher = new PostMatcher(
        ['hiring', 'developer', 'freelance', 'react', 'next.js'],
        ['looking\\s+for\\s+.*(dev|developer)', 'hiring.*developer']
      );
    });

    it('should find keyword matches', async () => {
      const matches = await matcher.findMatches(
        samplePosts,
        'test_correlation'
      );

      expect(matches).toHaveLength(2);
      expect(matches[0]?.post.id).toBe('hiring_post');
      expect(matches[0]?.matchedKeywords).toContain('hiring');
      expect(matches[0]?.matchedKeywords).toContain('developer');
      expect(matches[0]?.score).toBeUndefined();

      expect(matches[1]?.post.id).toBe('freelance_post');
      expect(matches[1]?.matchedKeywords).toContain('freelance');
      expect(matches[1]?.matchedKeywords).toContain('developer');
    });

    it('should find regex matches', async () => {
      const matches = await matcher.findMatches(
        samplePosts,
        'test_correlation'
      );

      const freelanceMatch = matches.find(
        (match: MatchResult) => match.post.id === 'freelance_post'
      );
      expect(freelanceMatch).toBeDefined();
      expect(freelanceMatch?.matchedKeywords).toContain(
        'looking for freelance next.js dev'
      );
    });

    it('should not match unrelated posts', async () => {
      const matches = await matcher.findMatches(
        samplePosts,
        'test_correlation'
      );

      const unrelatedMatch = matches.find(
        (match: MatchResult) => match.post.id === 'unrelated_post'
      );
      expect(unrelatedMatch).toBeUndefined();
    });
  });

  describe('findMatches with Gemini', () => {
    it('should include posts that pass Gemini threshold', async () => {
      mockGeminiClient.setScore('hiring_post', 0.8);
      mockGeminiClient.setScore('freelance_post', 0.9);

      const matches = await matcher.findMatches(
        samplePosts,
        'test_correlation'
      );

      expect(matches).toHaveLength(2);
      expect(matches[0]?.score).toBe(0.8);
      expect(matches[1]?.score).toBe(0.9);
    });

    it('should exclude posts that fail Gemini threshold', async () => {
      mockGeminiClient.setScore('hiring_post', 0.6); // Below 0.7 threshold
      mockGeminiClient.setScore('freelance_post', 0.8);

      const matches = await matcher.findMatches(
        samplePosts,
        'test_correlation'
      );

      expect(matches).toHaveLength(1);
      expect(matches[0]?.post.id).toBe('freelance_post');
      expect(matches[0]?.score).toBe(0.8);
    });

    it('should fall back to keyword matching if Gemini fails', async () => {
      // Override the mock to throw an error
      jest
        .spyOn(mockGeminiClient, 'scorePost')
        .mockRejectedValueOnce(new Error('API error'));

      const matches = await matcher.findMatches(
        [samplePosts[0]!],
        'test_correlation'
      );

      expect(matches).toHaveLength(1);
      expect(matches[0]?.score).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty posts array', async () => {
      const matches = await matcher.findMatches([], 'test_correlation');
      expect(matches).toHaveLength(0);
    });

    it('should handle case insensitive matching', async () => {
      const upperCasePost: RedditPost = {
        id: 'upper_case',
        title: 'HIRING REACT DEVELOPER',
        author: 'employer',
        permalink: '/test/',
        subreddit: 'test',
        score: 10,
        createdUtc: Date.now() / 1000,
      };

      mockGeminiClient.setScore('upper_case', 0.8);

      const matches = await matcher.findMatches(
        [upperCasePost],
        'test_correlation'
      );

      expect(matches).toHaveLength(1);
      expect(matches[0]?.matchedKeywords).toContain('hiring');
      expect(matches[0]?.matchedKeywords).toContain('developer');
    });

    it('should remove duplicate keywords', async () => {
      const duplicatePost: RedditPost = {
        id: 'duplicate',
        title: 'hiring hiring developer developer',
        author: 'employer',
        permalink: '/test/',
        subreddit: 'test',
        score: 10,
        createdUtc: Date.now() / 1000,
      };

      mockGeminiClient.setScore('duplicate', 0.8);

      const matches = await matcher.findMatches([duplicatePost], 'test_correlation');

      expect(matches).toHaveLength(1);
      const matchedKeywords = matches[0]?.matchedKeywords ?? [];
      const uniqueKeywords = [...new Set(matchedKeywords)];
      expect(matchedKeywords).toEqual(uniqueKeywords);
    });
  });
});
