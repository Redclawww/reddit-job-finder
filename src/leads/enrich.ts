import { CanonicalLead } from "./types";

const techKeywords = [
  "typescript",
  "javascript",
  "next.js",
  "nextjs",
  "react",
  "node",
  "node.js",
  "express",
  "postgres",
  "postgresql",
  "supabase",
  "prisma",
  "mongodb",
  "ai",
  "llm",
  "openai",
  "gemini",
  "automation",
  "scraper",
  "web scraping",
  "dashboard",
  "stripe",
  "saas",
  "tailwind",
  "python",
  "fastapi",
];

const remoteKeywords = [
  "remote",
  "work from anywhere",
  "anywhere",
  "async",
];

const freelanceKeywords = [
  "freelance",
  "contract",
  "contractor",
  "part-time",
  "part time",
  "gig",
  "project",
];

const jobKeywords = [
  "hiring",
  "hire",
  "looking for developer",
  "looking for a developer",
  "looking for engineer",
  "founding engineer",
];

const technicalProblemKeywords = [
  "need help",
  "how do i build",
  "how to build",
  "looking for someone to build",
  "can someone build",
  "need someone to build",
];

export function enrichLead(lead: CanonicalLead): CanonicalLead {
  const text = lead.rawText.toLowerCase();

  const techStack = techKeywords.filter((keyword) =>
    text.includes(keyword.toLowerCase())
  );

  const remote = remoteKeywords.some((keyword) => text.includes(keyword));

  let opportunityType = lead.opportunityType;

  if (freelanceKeywords.some((keyword) => text.includes(keyword))) {
    opportunityType = "freelance";
  } else if (jobKeywords.some((keyword) => text.includes(keyword))) {
    opportunityType = "job";
  } else if (
    technicalProblemKeywords.some((keyword) => text.includes(keyword))
  ) {
    opportunityType = "technical_problem";
  }

  return {
    ...lead,
    remote,
    opportunityType,
    techStack: [...new Set(techStack)],
    budget: extractBudget(text),
    contactMethod: extractContactMethod(lead.rawText),
  };
}

function extractBudget(text: string): CanonicalLead["budget"] | undefined {
  const usdHourly = text.match(/\$([0-9]{2,4})\s*\/?\s*(hr|hour)/i);
  if (usdHourly) {
    return {
      min: Number(usdHourly[1]),
      currency: "USD",
      period: "hour",
    };
  }

  const usdProject = text.match(/\$([0-9]{3,6})\s*(project|fixed|budget)?/i);
  if (usdProject) {
    return {
      min: Number(usdProject[1]),
      currency: "USD",
      period: "project",
    };
  }

  return undefined;
}

function extractContactMethod(text: string): string | undefined {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) return email[0];

  if (/dm me|send me a dm|pm me|message me/i.test(text)) {
    return "DM";
  }

  if (/apply/i.test(text)) {
    return "Apply link";
  }

  return undefined;
}
