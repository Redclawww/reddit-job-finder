import {
  buildCanonicalOpportunity,
  buildCanonicalText,
} from '../../src/lib/opportunity';
import { defaultProfile } from '../../src/config/profile';

describe('opportunity builder', () => {
  it('builds a canonical opportunity document from a scraped reddit post', () => {
    const opportunity = buildCanonicalOpportunity({
      id: 'abc123',
      title: 'Hiring React / Node developer for startup MVP',
      body: 'Need dashboard work, API integrations, and Postgres experience.',
      flair: 'Hiring',
      author: 'startupfounder',
      permalink: 'https://reddit.com/r/forhire/comments/abc123',
      subreddit: 'forhire',
      score: 25,
      commentsCount: 7,
      createdUtc: new Date('2026-04-20T09:30:00Z').getTime() / 1000,
      url: 'https://jobs.example.com/react-node-role',
      outboundDomain: 'jobs.example.com',
    });

    expect(opportunity).toEqual({
      postId: 'abc123',
      subreddit: 'forhire',
      title: 'Hiring React / Node developer for startup MVP',
      body: 'Need dashboard work, API integrations, and Postgres experience.',
      flair: 'Hiring',
      author: 'startupfounder',
      permalink: 'https://reddit.com/r/forhire/comments/abc123',
      outboundUrl: 'https://jobs.example.com/react-node-role',
      outboundDomain: 'jobs.example.com',
      createdAt: '2026-04-20T09:30:00.000Z',
      redditScore: 25,
      commentsCount: 7,
    });
  });

  it('creates a canonical text blob that includes the profile context fields', () => {
    const opportunity = buildCanonicalOpportunity({
      id: 'abc123',
      title: 'Hiring React / Node developer for startup MVP',
      body: 'Need dashboard work, API integrations, and Postgres experience.',
      flair: 'Hiring',
      author: 'startupfounder',
      permalink: 'https://reddit.com/r/forhire/comments/abc123',
      subreddit: 'forhire',
      score: 25,
      commentsCount: 7,
      createdUtc: new Date('2026-04-20T09:30:00Z').getTime() / 1000,
      url: 'https://jobs.example.com/react-node-role',
      outboundDomain: 'jobs.example.com',
    });

    const text = buildCanonicalText(opportunity, defaultProfile);

    expect(text).toContain('Profile version: v1');
    expect(text).toContain('Subreddit: forhire');
    expect(text).toContain('Flair: Hiring');
    expect(text).toContain('Title: Hiring React / Node developer for startup MVP');
    expect(text).toContain(
      'Body: Need dashboard work, API integrations, and Postgres experience.'
    );
    expect(text).toContain('Outbound domain: jobs.example.com');
    expect(text).toContain('Target roles: software developer, full stack developer, founding engineer');
  });
});
