import nock from 'nock';
import { createGeminiClient } from '../../src/lib/gemini';

describe('Gemma 4 Gemini API client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = 'test-api-key';
    delete process.env.GEMINI_MODEL;
    nock.cleanAll();
  });

  afterEach(() => {
    process.env = originalEnv;
    nock.cleanAll();
  });

  it('uses gemma-4-26b-a4b-it by default and parses the score response', async () => {
    const client = createGeminiClient();

    const scope = nock('https://generativelanguage.googleapis.com')
      .matchHeader('x-goog-api-key', 'test-api-key')
      .post('/v1beta/models/gemma-4-26b-a4b-it:generateContent')
      .reply(200, {
        candidates: [
          {
            content: {
              parts: [{ text: '0.82' }],
            },
          },
        ],
      });

    const result = await client!.scorePost(
      {
        id: 'post-1',
        title: '[Hiring] Senior React Developer',
        author: 'hiring-manager',
        permalink: 'https://reddit.com/r/forhire/comments/post-1',
        subreddit: 'forhire',
        score: 12,
        createdUtc: Date.now() / 1000,
      },
      'corr-1'
    );

    expect(result.score).toBe(0.82);
    expect(scope.isDone()).toBe(true);
  });
});
