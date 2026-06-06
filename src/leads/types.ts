export type Source = "reddit";

export type OpportunityType =
  | "job"
  | "freelance"
  | "contract"
  | "internship"
  | "bounty"
  | "technical_problem"
  | "cofounder_search"
  | "unknown";

export type RawRedditPost = {
  id: string;
  subreddit: string;
  title: string;
  body?: string;
  author?: string;
  url: string;
  permalink: string;
  createdAt: string;
  score?: number;
  comments?: number;
  flair?: string;
  raw: unknown;
};

export type CanonicalLead = {
  id: string;
  source: Source;
  sourceId: string;
  sourceUrl: string;
  title: string;
  body: string;
  author?: string;
  createdAt: string;
  collectedAt: string;

  subreddit?: string;
  flair?: string;

  company?: string;
  role?: string;
  opportunityType: OpportunityType;
  location?: string;
  remote?: boolean;

  budget?: {
    min?: number;
    max?: number;
    currency?: string;
    period?: "hour" | "month" | "year" | "project";
  };

  techStack: string[];
  contactMethod?: string;

  engagement: {
    score?: number;
    comments?: number;
  };

  rawText: string;
  canonicalHash: string;
};

export type HeuristicScore = {
  passed: boolean;
  score: number;
  positiveSignals: string[];
  negativeSignals: string[];
  rejectionReasons: string[];
};

export type AiLeadScore = {
  isOpportunity: boolean;
  opportunityType: OpportunityType;
  fitScore: number;
  urgencyScore: number;
  competitionScore: number;
  budgetScore: number;
  trustScore: number;
  replyWorthiness: number;
  finalScore: number;
  matchingReasons: string[];
  concerns: string[];
  suggestedReply?: string;
  tags: string[];
};

export type FinalLeadScore = {
  leadId: string;
  heuristicScore: number;
  aiScore?: number;
  freshnessScore: number;
  competitionScore: number;
  finalScore: number;
  reasons: string[];
  concerns: string[];
  suggestedReply?: string;
};
