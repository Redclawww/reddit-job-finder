import { CanonicalLead, HeuristicScore } from "../leads/types";
import { userProfile } from "../config/profile";

const hardRejectPatterns = [
  /\bhire me\b/i,
  /\bfor hire\b/i,
  /\blooking for work\b/i,
  /\blooking for job\b/i,
  /\bneed a job\b/i,
  /\bresume review\b/i,
  /\bunpaid\b/i,
  /\bvolunteer only\b/i,
  /\bequity only\b/i,
  /\bcommission only\b/i,
  /\bonsite only\b/i,
  /\bshowcase\b/i,
  /\bmy new library\b/i,
  /\bopen source\b/i,
  /\bopen-source\b/i,
  /\bi built a\b/i,
  /\bcreated a library\b/i,
  /\bfree boilerplate\b/i,
  /\btutorial\b/i,
  /\bblog post\b/i,
  /\bcase study\b/i,
  /\bwhat stack\b/i,
  /\bwhich stack\b/i,
  /\bhow would you build\b/i,
  /\bnative english speaker\b/i,
  /\bjoining calls\b/i,
  /\bon behalf of (our|a|the) developer\b/i,
  /\bproxy\b/i,
];

const buyerIntentPatterns = [
  /\[hiring\]/i,
  /\bhiring\b/i,
  /\bwe'?re hiring\b/i,
  /\blooking for (someone|a developer|an engineer|a freelancer|a contractor|help|developers|engineers|freelancers|contractors)\b/i,
  /\bneed (someone|a developer|an engineer|a freelancer|a contractor|help|developers|engineers|freelancers|contractors)\b/i,
  /\bseeking (a developer|an engineer|a freelancer|a contractor|help|developers|engineers|freelancers|contractors)\b/i,
  /\bonboard (freelance )?(developer|developers|engineer|engineers|contractor|contractors|freelancer|freelancers)\b/i,
  /\b(developer|engineer) positions?\b/i,
  /\bcan someone build\b/i,
  /\bbuild (me|us) .*\b/i,
  /\bpaid (contract|project|gig|work|role)\b/i,
  /\bpaid per\b/i,
  /\bcompensation\b/i,
  /\b(flat )?daily rates?\b/i,
  /\bbudget\b/i,
  /\$[0-9][0-9,]*(\s|$|\.|,)/i,
];

const strongProfilePatterns = [
  /\bfull[-\s]?stack\b/i,
  /\bfront[-\s]?end\b/i,
  /\bbackend\b/i,
  /\bfounding engineer\b/i,
  /\btypescript\b/i,
  /\bjavascript\b/i,
  /\bnext\.?js\b/i,
  /\breact\b/i,
  /\bnode\.?js\b/i,
  /\bexpress\b/i,
  /\bpostgres(?:ql)?\b/i,
  /\bsupabase\b/i,
  /\bprisma\b/i,
  /\bai (app|application|agent|automation|integration|tool)\b/i,
  /\bllm\b/i,
  /\bopenai\b/i,
  /\bautomation\b/i,
  /\bweb scraping\b/i,
  /\bscraper\b/i,
  /\btelegram bot\b/i,
  /\bdiscord bot\b/i,
  /\bdashboard\b/i,
  /\bstripe\b/i,
  /\bsaas\b/i,
  /\bmvp\b/i,
  /\bmodern web (app|application|applications)\b/i,
  /\bweb modules?\b/i,
  /\bsoftware bugs?\b/i,
  /\bbug fixes\b/i,
  /\bapplication updates\b/i,
  /\bui (fixes|implementation|inconsistencies)\b/i,
];

const positiveSignals: Record<string, number> = {
  "founding engineer": 10,
  "full stack": 9,
  "full-stack": 9,
  "typescript": 8,
  "next.js": 8,
  "nextjs": 8,
  "react": 7,
  "node": 7,
  "node.js": 7,
  "ai app": 9,
  "llm": 8,
  "automation": 8,
  "scraper": 8,
  "web scraping": 8,
  "saas": 8,
  "mvp": 8,
  "contract": 7,
  "freelance": 8,
  "part-time": 7,
  "part time": 7,
  "remote": 6,
  "dashboard": 6,
  "backend": 6,
  "web application": 6,
  "web applications": 6,
  "software bug": 5,
  "software bugs": 5,
  "bug fixes": 5,
  "application updates": 5,
  "ui inconsistencies": 5,
};

const negativeSignals: Record<string, number> = {
  "unpaid": -20,
  "equity only": -20,
  "commission only": -20,
  "hire me": -15,
  "for hire": -12,
  "looking for work": -15,
  "senior staff": -8,
  "principal engineer": -8,
  "10+ years": -8,
  "onsite only": -10,
  "us citizens only": -10,
  "i built": -15,
  "my new app": -10,
  "check out my": -15,
  "npm install": -15,
  "github.com": -5,
};

export function scoreLeadHeuristically(lead: CanonicalLead): HeuristicScore {
  const text = lead.rawText.toLowerCase();
  const rejectionReasons: string[] = [];

  for (const pattern of hardRejectPatterns) {
    if (pattern.test(text)) {
      rejectionReasons.push(`Hard reject pattern matched: ${pattern}`);
    }
  }

  if (isTooOld(lead.createdAt)) {
    rejectionReasons.push("Lead is too old");
  }

  if (!hasBuyerIntent(text)) {
    rejectionReasons.push("No explicit buyer, hiring, or paid-work intent");
  }

  if (!hasStrongProfileMatch(text)) {
    rejectionReasons.push("No strong match for target roles or technical profile");
  }

  const matchedPositive: string[] = [];
  const matchedNegative: string[] = [];

  let rawScore = 0;

  for (const [keyword, value] of Object.entries(positiveSignals)) {
    if (text.includes(keyword)) {
      rawScore += value;
      matchedPositive.push(keyword);
    }
  }

  for (const [keyword, value] of Object.entries(negativeSignals)) {
    if (text.includes(keyword)) {
      rawScore += value;
      matchedNegative.push(keyword);
    }
  }

  for (const skill of userProfile.skills) {
    if (text.includes(skill.toLowerCase())) {
      rawScore += 2;
      matchedPositive.push(`skill:${skill}`);
    }
  }

  // Engagement adjustment.
  // Low comments = potentially less competition.
  const comments = lead.engagement.comments ?? 0;
  if (comments <= 2) rawScore += 5;
  else if (comments <= 10) rawScore += 2;
  else if (comments > 40) rawScore -= 4;

  // Normalize score to 0-1, but allow it to drop to 0 if negatives outweigh positives.
  const normalizedScore = Math.max(0, Math.min(1, rawScore / 40));

  const passed =
    rejectionReasons.length === 0 &&
    normalizedScore >= 0.25 &&
    matchedPositive.length > 0;

  return {
    passed,
    score: normalizedScore,
    positiveSignals: matchedPositive,
    negativeSignals: matchedNegative,
    rejectionReasons,
  };
}

function hasBuyerIntent(text: string): boolean {
  return buyerIntentPatterns.some((pattern) => pattern.test(text));
}

function hasStrongProfileMatch(text: string): boolean {
  return strongProfilePatterns.some((pattern) => pattern.test(text));
}

function isTooOld(createdAt: string): boolean {
  const maxAgeHours = Number(process.env.MAX_POST_AGE_HOURS ?? 48);
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const ageHours = (now - created) / (1000 * 60 * 60);

  return ageHours > maxAgeHours;
}
