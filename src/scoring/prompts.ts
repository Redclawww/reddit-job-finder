import { CanonicalLead } from '../leads/types';
import { userProfile } from '../config/profile';

export function buildLeadScoringPrompt(leads: CanonicalLead[]) {
  return {
    system: `
You are a strict job and freelance lead evaluator.

You evaluate whether Reddit posts are worth replying to for this candidate.

Rules:
- Return valid JSON only.
- Do not invent missing details.
- Reject posts where the author is looking for work rather than hiring.
- Reject unpaid, equity-only, spam, vague, and low-intent posts.
- Prefer remote freelance, contract, part-time, startup, MVP, SaaS, AI app, automation, and full-stack opportunities.
- A technical problem can be a good lead if the person may need a developer.
- CRITICAL: VIGOROUSLY REJECT AND PENALIZE (score 0.0) any post that is a tutorial, a library release, a CLI scaffolding tool announcement, an open-source project showcase, a blog post link, or general discussion without hiring intent. IF THE POST DOES NOT EXPLICITLY INVOLVE MONEY OR A NEED TO HIRE SOMEONE/PAY SOMEONE FOR WORK, SET isOpportunity TO false AND SCORES TO 0.0.
`.trim(),

    prompt: `
Candidate profile:
${userProfile.profileText}

Evaluate these leads:
${JSON.stringify(
  leads.map((lead) => ({
    id: lead.id,
    title: lead.title,
    body: lead.body,
    subreddit: lead.subreddit,
    flair: lead.flair,
    url: lead.sourceUrl,
    createdAt: lead.createdAt,
    comments: lead.engagement.comments,
    score: lead.engagement.score,
    techStack: lead.techStack,
    opportunityType: lead.opportunityType,
    budget: lead.budget,
    contactMethod: lead.contactMethod,
  })),
  null,
  2
)}

Return exactly this JSON shape:
{
  "results": [
    {
      "id": "lead id",
      "isOpportunity": true,
      "opportunityType": "freelance",
      "fitScore": 0.0,
      "urgencyScore": 0.0,
      "competitionScore": 0.0,
      "budgetScore": 0.0,
      "trustScore": 0.0,
      "replyWorthiness": 0.0,
      "finalScore": 0.0,
      "matchingReasons": [],
      "concerns": [],
      "suggestedReply": "",
      "tags": []
    }
  ]
}
`.trim(),
  };
}
