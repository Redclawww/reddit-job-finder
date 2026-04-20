import nock from 'nock';
import { DiscordNotifier } from '../../src/lib/notifier';
import { HttpClient } from '../../src/lib/http-client';
import { MatchResult } from '../../src/types';

describe('DiscordNotifier Integration', () => {
  let notifier: DiscordNotifier;
  let httpClient: HttpClient;

  const webhookUrl = 'https://discord.com/api/webhooks/123/test-webhook';

  beforeEach(() => {
    httpClient = new HttpClient({
      userAgent: 'test-agent',
      maxRetries: 1,
      backoffMultiplier: 1.5,
      maxBackoffMs: 5000,
    });
    notifier = new DiscordNotifier(webhookUrl, httpClient);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should send Discord notification successfully', async () => {
    const matchResult: MatchResult = {
      post: {
        id: 'test123',
        title: '[Hiring] React Developer',
        author: 'testuser',
        permalink: 'https://reddit.com/r/forhire/comments/test123/',
        subreddit: 'forhire',
        score: 42,
        createdUtc: Date.now() / 1000,
      },
      matchedKeywords: ['hiring', 'react', 'developer'],
      score: 0.85,
      finalScore: 0.88,
      decision: 'notify_immediately',
      decisionReasons: [
        'Strong core skill overlap: react, node.js, typescript',
        'Matches remote work preference',
      ],
      requiredSkills: ['react', 'node.js', 'typescript'],
      employmentType: 'contract',
      remoteType: 'remote',
      locationConstraint: 'none stated',
      budgetOrSalary: 'not specified',
      profileVersion: 'v1',
    };

    let capturedBody: Record<string, unknown> | undefined;

    const scope = nock('https://discord.com')
      .post('/api/webhooks/123/test-webhook', (body) => {
        capturedBody = body as Record<string, unknown>;
        return true;
      })
      .reply(204);

    await notifier.notify(matchResult, 'test_correlation');

    expect(scope.isDone()).toBe(true);
    const embeds = capturedBody?.embeds as Array<{ fields: Array<{ name: string; value: string }> }>;
    const fieldMap = new Map(
      (embeds?.[0]?.fields || []).map((field) => [field.name, field.value])
    );
    expect(fieldMap.get('Final Fit')).toBe('0.88');
    expect(fieldMap.get('Required Skills')).toContain('react');
    expect(fieldMap.get('Why Matched')).toContain(
      'Strong core skill overlap: react, node.js, typescript'
    );
  });

  it('should retry and recover from Discord rate limiting', async () => {
    const matchResult: MatchResult = {
      post: {
        id: 'test123',
        title: '[Hiring] React Developer',
        author: 'testuser',
        permalink: 'https://reddit.com/r/forhire/comments/test123/',
        subreddit: 'forhire',
        score: 42,
        createdUtc: Date.now() / 1000,
      },
      matchedKeywords: ['hiring'],
    };

    // Mock rate limit response
    nock('https://discord.com')
      .post('/api/webhooks/123/test-webhook')
      .reply(429, '', { 'retry-after': '1' })
      .post('/api/webhooks/123/test-webhook')
      .reply(204);

    await expect(notifier.notify(matchResult, 'test_correlation')).resolves.toBe(
      undefined
    );
  });
});
