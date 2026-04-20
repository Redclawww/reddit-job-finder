import {
  CanonicalOpportunity,
  OpportunityFacts,
  Profile,
  RedditPost,
  RuleFilterResult,
} from '../types';

export function buildCanonicalOpportunity(
  post: RedditPost
): CanonicalOpportunity {
  return {
    postId: post.id,
    subreddit: post.subreddit,
    title: post.title,
    body: post.body || '',
    flair: post.flair || '',
    author: post.author,
    permalink: post.permalink,
    outboundUrl: post.url,
    outboundDomain:
      post.outboundDomain || inferOutboundDomain(post.url) || 'reddit.com',
    createdAt: new Date(post.createdUtc * 1000).toISOString(),
    redditScore: post.score,
    commentsCount: post.commentsCount || 0,
  };
}

export function buildCanonicalText(
  opportunity: CanonicalOpportunity,
  profile: Profile
): string {
  return [
    `Profile version: ${profile.profileVersion}`,
    `Target roles: ${profile.targetRoles.join(', ')}`,
    `Core skills: ${profile.coreSkills.join(', ')}`,
    `Employment preferences: ${profile.employmentPreferences.join(', ')}`,
    `Location preference: ${profile.locationPreference}`,
    `Subreddit: ${opportunity.subreddit}`,
    `Flair: ${opportunity.flair || 'none'}`,
    `Title: ${opportunity.title}`,
    `Body: ${opportunity.body || 'none'}`,
    `Outbound domain: ${opportunity.outboundDomain}`,
    `Author: ${opportunity.author}`,
  ].join('\n');
}

export function applyRuleFilter(
  opportunity: CanonicalOpportunity,
  profile: Profile
): RuleFilterResult {
  const text = normalizeText(
    [
      opportunity.title,
      opportunity.body,
      opportunity.flair,
      opportunity.outboundDomain,
    ].join(' ')
  );

  const rejectReasons: string[] = [];
  const positiveSignals: string[] = [];

  if (containsAny(text, ['[for hire]', 'for hire', 'hire me'])) {
    rejectReasons.push('for_hire_phrase');
  }

  if (containsAny(text, ['for sale', 'selling'])) {
    rejectReasons.push('sale_post');
  }

  if (profile.avoid.some((term) => text.includes(term.toLowerCase()))) {
    rejectReasons.push('profile_avoid_term');
  }

  if (containsAny(text, ['hiring', 'looking for', 'seeking', 'need developer'])) {
    positiveSignals.push('hiring_phrase');
  }

  if (opportunity.flair.toLowerCase().includes('hiring')) {
    positiveSignals.push('hiring_flair');
  }

  if (opportunity.outboundUrl) {
    positiveSignals.push('outbound_link');
  }

  if (containsAny(text, ['remote', 'work from home', 'wfh', 'global remote'])) {
    positiveSignals.push('remote_language');
  }

  return {
    passesRules: rejectReasons.length === 0 && positiveSignals.length > 0,
    rejectReasons,
    positiveSignals: [...new Set(positiveSignals)],
  };
}

export function extractOpportunityFacts(
  opportunity: CanonicalOpportunity,
  profile: Profile
): OpportunityFacts {
  const text = normalizeText(buildCanonicalText(opportunity, profile));

  const requiredSkills = profile.coreSkills.filter((skill) =>
    getSkillPatterns(skill).some((pattern) => text.includes(pattern))
  );
  const optionalSkills = profile.niceToHave.filter((skill) =>
    getSkillPatterns(skill).some((pattern) => text.includes(pattern))
  );

  const roleLabels: string[] = [];

  if (containsAny(text, ['full stack', 'fullstack'])) {
    roleLabels.push('full_stack');
  }
  if (containsAny(text, ['founding engineer', 'startup'])) {
    roleLabels.push('startup');
  }
  if (containsAny(text, ['contract', 'freelance'])) {
    roleLabels.push('contract');
  }

  const employmentType = containsAny(text, ['freelance'])
    ? 'freelance'
    : containsAny(text, ['contract'])
      ? 'contract'
      : containsAny(text, ['full time', 'full-time'])
        ? 'full_time'
        : 'unspecified';

  const remoteType = containsAny(text, ['remote', 'global remote', 'work from home'])
    ? 'remote'
    : containsAny(text, ['hybrid'])
      ? 'hybrid'
      : containsAny(text, ['onsite', 'on-site', 'on site'])
        ? 'onsite'
        : 'unspecified';

  const locationConstraint = extractLocationConstraint(text);
  const budgetOrSalary = extractBudget(text);

  const reasonsForFit: string[] = [];
  const reasonsAgainstFit: string[] = [];

  if (requiredSkills.length > 0) {
    reasonsForFit.push(
      `Strong core skill overlap: ${requiredSkills.slice(0, 4).join(', ')}`
    );
  }

  if (remoteType === 'remote') {
    reasonsForFit.push('Matches remote work preference');
  } else if (remoteType === 'onsite') {
    reasonsAgainstFit.push('On-site language detected');
  }

  if (containsAny(text, ['startup', 'mvp', 'founding'])) {
    reasonsForFit.push('Startup-oriented language detected');
  }

  if (!budgetOrSalary || budgetOrSalary === 'not specified') {
    reasonsAgainstFit.push('Budget not specified');
  }

  const jobSignals = [
    containsAny(text, ['hiring', 'looking for', 'seeking', 'need developer']),
    opportunity.flair.toLowerCase().includes('hiring'),
    Boolean(opportunity.outboundUrl),
    requiredSkills.length > 0,
  ].filter(Boolean).length;

  const confidence = Math.min(1, 0.4 + jobSignals * 0.12);

  return {
    isJob: jobSignals >= 2,
    roleLabels: [...new Set(roleLabels)],
    requiredSkills,
    optionalSkills,
    employmentType,
    remoteType,
    locationConstraint,
    budgetOrSalary,
    confidence,
    reasonsForFit,
    reasonsAgainstFit,
  };
}

export function rankOpportunity(
  opportunity: CanonicalOpportunity,
  facts: OpportunityFacts,
  rules: RuleFilterResult,
  profile: Profile,
  aiScore?: number
): {
  finalScore: number;
  decision: 'notify_immediately' | 'digest' | 'reject';
  decisionReasons: string[];
} {
  const skillOverlap = profile.coreSkills.length
    ? facts.requiredSkills.length / profile.coreSkills.length
    : 0;
  const employmentTypeMatch =
    facts.employmentType !== 'unspecified' &&
    profile.employmentPreferences.includes(facts.employmentType)
      ? 1
      : facts.employmentType === 'unspecified'
        ? 0.5
        : 0.25;
  const locationMatch =
    facts.remoteType === 'remote'
      ? 1
      : facts.remoteType === 'unspecified'
        ? 0.6
        : 0.2;
  const seniorityMatch = containsAny(
    normalizeText([opportunity.title, opportunity.body].join(' ')),
    ['senior', 'lead', 'staff']
  )
    ? 0.45
    : 0.8;
  const subredditQuality = getSubredditQuality(opportunity.subreddit);
  const jobConfidence = aiScore ?? facts.confidence;

  const finalScore =
    0.35 * jobConfidence +
    0.25 * skillOverlap +
    0.15 * employmentTypeMatch +
    0.1 * locationMatch +
    0.1 * seniorityMatch +
    0.05 * subredditQuality;

  const decision =
    finalScore >= 0.7 ? 'notify_immediately' : finalScore >= 0.55 ? 'digest' : 'reject';

  const decisionReasons = [
    ...facts.reasonsForFit,
    ...rules.positiveSignals.map((signal) => formatSignal(signal)),
  ];

  return {
    finalScore,
    decision,
    decisionReasons: [...new Set(decisionReasons)].slice(0, 4),
  };
}

function inferOutboundDomain(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).hostname;
  } catch (_error) {
    return undefined;
  }
}

function normalizeText(text: string): string {
  return text.toLowerCase();
}

function containsAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase.toLowerCase()));
}

function getSkillPatterns(skill: string): string[] {
  const normalized = skill.toLowerCase();

  switch (normalized) {
    case 'node.js':
      return ['node.js', 'nodejs', ' node '];
    case 'next.js':
      return ['next.js', 'nextjs'];
    case 'api integration':
      return ['api integration', 'api integrations', 'integrations'];
    default:
      return [normalized];
  }
}

function extractLocationConstraint(text: string): string {
  if (containsAny(text, ['india'])) {
    return 'india';
  }
  if (containsAny(text, ['us only', 'usa only', 'united states'])) {
    return 'us_only';
  }
  if (containsAny(text, ['eu only', 'europe only'])) {
    return 'eu_only';
  }
  if (containsAny(text, ['remote', 'global'])) {
    return 'none stated';
  }

  return 'none stated';
}

function extractBudget(text: string): string {
  const match = text.match(
    /(\$[\d,]+(?:\s*(?:\/hour|\/hr|hour|hr|monthly|month))?|₹[\d,]+)/
  );

  return match?.[1] || 'not specified';
}

function getSubredditQuality(subreddit: string): number {
  const highSignal = new Set([
    'forhire',
    'hireaprogrammer',
    'freelance',
    'remotejs',
    'jobs',
  ]);

  return highSignal.has(subreddit.toLowerCase()) ? 0.9 : 0.6;
}

function formatSignal(signal: string): string {
  switch (signal) {
    case 'hiring_flair':
      return 'Hiring flair detected';
    case 'hiring_phrase':
      return 'Hiring language detected';
    case 'outbound_link':
      return 'External apply link present';
    case 'remote_language':
      return 'Remote language detected';
    default:
      return signal;
  }
}
