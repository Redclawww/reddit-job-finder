import { Readable } from 'node:stream';
import nock from 'nock';
import {
  formatNvidiaKimiError,
  NvidiaKimiScorer,
  parseNvidiaKimiScoringResponse,
} from '../../src/scoring/nvidia-kimi-score';
import { CanonicalLead } from '../../src/leads/types';

const lead: CanonicalLead = {
  id: 'lead-1',
  source: 'reddit',
  sourceId: 'abc',
  sourceUrl: 'https://reddit.com/r/forhire/comments/abc',
  title: 'Hiring Next.js developer for SaaS MVP',
  body: 'Paid contract for a remote Next.js and Node developer.',
  createdAt: '2026-05-16T00:00:00.000Z',
  collectedAt: '2026-05-16T00:00:00.000Z',
  opportunityType: 'contract',
  techStack: ['nextjs', 'node'],
  engagement: { score: 12, comments: 3 },
  rawText: 'Hiring Next.js developer for SaaS MVP',
  canonicalHash: 'hash',
};

describe('NvidiaKimiScorer', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('scores leads through NVIDIA Kimi chat completions streaming API', async () => {
    const responseJson = JSON.stringify({
      results: [
        {
          id: 'lead-1',
          isOpportunity: true,
          opportunityType: 'contract',
          fitScore: 0.9,
          urgencyScore: 0.8,
          competitionScore: 0.7,
          budgetScore: 0.8,
          trustScore: 0.7,
          replyWorthiness: 0.9,
          finalScore: 0.86,
          matchingReasons: ['paid Next.js contract'],
          concerns: [],
          suggestedReply: 'Hi, I can help.',
          tags: ['nextjs'],
        },
      ],
    });

    const scope = nock('https://integrate.api.nvidia.com', {
      reqheaders: {
        authorization: 'Bearer test-key',
        accept: 'text/event-stream',
      },
    })
      .post('/v1/chat/completions', (body) => {
        expect(body.model).toBe('moonshotai/kimi-k2.6');
        expect(body.max_tokens).toBe(16384);
        expect(body.temperature).toBe(1);
        expect(body.top_p).toBe(1);
        expect(body.stream).toBe(true);
        expect(body.chat_template_kwargs).toEqual({ thinking: true });
        expect(body.messages).toEqual([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]);
        return true;
      })
      .reply(
        200,
        Readable.from([
          `data: ${JSON.stringify({
            choices: [{ delta: { content: responseJson.slice(0, 30) } }],
          })}\n\n`,
          `data: ${JSON.stringify({
            choices: [{ delta: { content: responseJson.slice(30) } }],
          })}\n\n`,
          'data: [DONE]\n\n',
        ]),
        { 'Content-Type': 'text/event-stream' }
      );

    const scorer = new NvidiaKimiScorer('test-key');

    const scores = await scorer.scoreLeads([lead]);

    expect(scores.get('lead-1')?.finalScore).toBe(0.86);
    expect(scope.isDone()).toBe(true);
  });
});

describe('parseNvidiaKimiScoringResponse', () => {
  it('accepts JSON wrapped in a markdown code fence', () => {
    const parsed = parseNvidiaKimiScoringResponse(
      '```json\n{"results":[{"id":"lead-1","finalScore":0.8}]}\n```'
    );

    expect(parsed.results[0]?.id).toBe('lead-1');
  });

  it('throws a clear error when no JSON content is returned', () => {
    expect(() => parseNvidiaKimiScoringResponse('')).toThrow(
      'NVIDIA Kimi response did not contain JSON content'
    );
  });
});

describe('formatNvidiaKimiError', () => {
  it('summarizes Axios errors without leaking request headers or payloads', () => {
    const formatted = formatNvidiaKimiError({
      isAxiosError: true,
      message: 'Request failed with status code 504',
      response: {
        status: 504,
        statusText: 'Gateway Timeout',
      },
      config: {
        headers: {
          Authorization: 'Bearer secret-key',
        },
        data: 'prompt contents',
      },
    });

    expect(formatted).toBe('NVIDIA Kimi scoring failed: 504 Gateway Timeout');
    expect(formatted).not.toContain('secret-key');
    expect(formatted).not.toContain('prompt contents');
  });
});
