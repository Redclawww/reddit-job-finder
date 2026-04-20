import { BatchProcessor } from '../../src/lib/batch-processor';
import { GeminiResponse, RedditPost } from '../../src/types';
import { IGeminiClient } from '../../src/types/interfaces';

class MockGeminiClient implements IGeminiClient {
  async scorePost(): Promise<GeminiResponse> {
    return {
      score: 0.9,
      reasoning: 'Looks like a real developer job',
    };
  }

  async scoreBatch(
    posts: RedditPost[]
  ): Promise<Array<{ post: RedditPost; response: GeminiResponse }>> {
    return posts.map((post) => ({
      post,
      response: {
        score: 0.9,
        reasoning: 'Looks like a real developer job',
      },
    }));
  }
}

describe('BatchProcessor MVP ranking', () => {
  it('returns an enriched ranked match for a promising hiring post', async () => {
    const processor = new BatchProcessor(
      {
        batchSize: 1,
        batchTimeoutMs: 1000,
        threshold: 0.7,
      },
      new MockGeminiClient(),
      ['hiring', 'remote', 'react', 'node.js', 'typescript', 'developer']
    );

    const matches = await processor.addPosts(
      [
        {
          id: 'job-1',
          title: 'Hiring React / Node developer for startup MVP',
          body: 'Remote contract role using TypeScript, Postgres, and API integrations.',
          flair: 'Hiring',
          author: 'startupfounder',
          permalink: 'https://reddit.com/r/forhire/comments/job-1',
          subreddit: 'forhire',
          score: 25,
          commentsCount: 7,
          createdUtc: Date.now() / 1000,
          url: 'https://jobs.example.com/react-node-role',
          outboundDomain: 'jobs.example.com',
        },
      ],
      'corr-1'
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.post.id).toBe('job-1');
    expect(matches[0]?.score).toBe(0.9);
    expect(matches[0]?.finalScore).toBeGreaterThan(0.7);
    expect(matches[0]?.decision).toBe('notify_immediately');
    expect(matches[0]?.requiredSkills).toEqual(
      expect.arrayContaining(['react', 'node.js', 'typescript'])
    );
    expect(matches[0]?.positiveSignals).toEqual(
      expect.arrayContaining(['hiring_flair', 'remote_language', 'outbound_link'])
    );
    expect(matches[0]?.decisionReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('core skill'),
        expect.stringContaining('remote'),
      ])
    );
    expect(matches[0]?.profileVersion).toBe('v1');
  });

  it('rejects obvious for-hire self promotion posts before notifying', async () => {
    const processor = new BatchProcessor(
      {
        batchSize: 1,
        batchTimeoutMs: 1000,
        threshold: 0.7,
      },
      new MockGeminiClient(),
      ['hiring', 'remote', 'react', 'developer']
    );

    const matches = await processor.addPosts(
      [
        {
          id: 'for-hire-1',
          title: '[For Hire] React developer available immediately',
          body: 'I am available for freelance work.',
          author: 'selfpromo',
          permalink: 'https://reddit.com/r/forhire/comments/for-hire-1',
          subreddit: 'forhire',
          score: 10,
          createdUtc: Date.now() / 1000,
        },
      ],
      'corr-2'
    );

    expect(matches).toHaveLength(0);
  });
});
