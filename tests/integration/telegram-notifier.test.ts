import nock from 'nock';
import { TelegramNotifier } from '../../src/lib/telegram-notifier';
import { HttpClient } from '../../src/lib/http-client';
import { MatchResult } from '../../src/types';

describe('TelegramNotifier Integration', () => {
  let notifier: TelegramNotifier;
  let httpClient: HttpClient;

  beforeEach(() => {
    httpClient = new HttpClient({
      userAgent: 'test-agent',
      maxRetries: 1,
      backoffMultiplier: 1.5,
      maxBackoffMs: 5000,
    });
    notifier = new TelegramNotifier('test-bot-token', '123456', httpClient);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('sends the scraped external job link and the Reddit discussion link', async () => {
    const matchResult: MatchResult = {
      post: {
        id: 'test123',
        title: '[Hiring] React Developer',
        author: 'testuser',
        permalink: 'https://reddit.com/r/forhire/comments/test123/',
        subreddit: 'forhire',
        score: 42,
        createdUtc: Date.now() / 1000,
        url: 'https://jobs.example.com/react-role',
      },
      matchedKeywords: ['hiring', 'react'],
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

    const scope = nock('https://api.telegram.org')
      .post('/bottest-bot-token/sendMessage', (body) => {
        capturedBody = body as Record<string, unknown>;
        return true;
      })
      .reply(200, { ok: true, result: { message_id: 1 } });

    await notifier.notify(matchResult, 'test-correlation');

    expect(scope.isDone()).toBe(true);
    expect(capturedBody?.text).toContain(
      'Strong Match: 0.88'
    );
    expect(capturedBody?.text).toContain(
      'Why matched:'
    );
    expect(capturedBody?.text).toContain(
      '- Strong core skill overlap: react, node.js, typescript'
    );
    expect(capturedBody?.text).toContain(
      'Required skills: react, node.js, typescript'
    );
    expect(capturedBody?.text).toContain(
      'Job Link: https://jobs.example.com/react-role'
    );
    expect(capturedBody?.text).toContain(
      'Reddit Link: https://reddit.com/r/forhire/comments/test123/'
    );
  });
});
