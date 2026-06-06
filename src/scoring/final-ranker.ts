import {
  AiLeadScore,
  CanonicalLead,
  FinalLeadScore,
  HeuristicScore,
} from "../leads/types";

export function rankLead(
  lead: CanonicalLead,
  heuristic: HeuristicScore,
  ai?: AiLeadScore
): FinalLeadScore {
  if (ai && !ai.isOpportunity) {
    return {
      leadId: lead.id,
      heuristicScore: heuristic.score,
      aiScore: ai.finalScore,
      freshnessScore: 0,
      competitionScore: 0,
      finalScore: 0,
      reasons: ["AI classified this as not an opportunity"],
      concerns: ai.concerns ?? [],
      suggestedReply: undefined,
    };
  }

  const freshnessScore = calculateFreshnessScore(lead.createdAt);
  const competitionScore = calculateCompetitionScore(
    lead.engagement.comments ?? 0
  );

  const aiScore = ai?.finalScore;

  const finalScore = ai
    ? heuristic.score * 0.2 +
      ai.finalScore * 0.55 +
      freshnessScore * 0.15 +
      competitionScore * 0.1
    : heuristic.score * 0.65 +
      freshnessScore * 0.2 +
      competitionScore * 0.15;

  return {
    leadId: lead.id,
    heuristicScore: heuristic.score,
    aiScore,
    freshnessScore,
    competitionScore,
    finalScore: clamp01(finalScore),
    reasons: ai?.matchingReasons ?? heuristic.positiveSignals,
    concerns: ai?.concerns ?? heuristic.negativeSignals,
    suggestedReply: ai?.suggestedReply,
  };
}

function calculateFreshnessScore(createdAt: string): number {
  const ageHours =
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);

  if (ageHours <= 2) return 1;
  if (ageHours <= 12) return 0.8;
  if (ageHours <= 24) return 0.6;
  if (ageHours <= 48) return 0.35;

  return 0.1;
}

function calculateCompetitionScore(comments: number): number {
  if (comments <= 2) return 1;
  if (comments <= 10) return 0.75;
  if (comments <= 30) return 0.45;

  return 0.2;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
