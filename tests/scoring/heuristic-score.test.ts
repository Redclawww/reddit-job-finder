import { CanonicalLead } from "../../src/leads/types";
import { scoreLeadHeuristically } from "../../src/scoring/heuristic-score";

function lead(overrides: Partial<CanonicalLead>): CanonicalLead {
  const title = overrides.title ?? "[Hiring] Full-stack developer needed";
  const body =
    overrides.body ??
    "Paid contract to build a Next.js dashboard with Supabase. Budget $2000. DM me.";

  return {
    id: overrides.id ?? "lead-1",
    source: "reddit",
    sourceId: overrides.sourceId ?? "lead-1",
    sourceUrl: overrides.sourceUrl ?? "https://reddit.com/r/forhire/comments/lead-1",
    title,
    body,
    author: overrides.author ?? "client",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    collectedAt: overrides.collectedAt ?? new Date().toISOString(),
    subreddit: overrides.subreddit ?? "forhire",
    flair: overrides.flair,
    company: overrides.company,
    role: overrides.role,
    opportunityType: overrides.opportunityType ?? "unknown",
    location: overrides.location,
    remote: overrides.remote,
    budget: overrides.budget,
    techStack: overrides.techStack ?? [],
    contactMethod: overrides.contactMethod,
    engagement: overrides.engagement ?? { comments: 0, score: 1 },
    rawText: overrides.rawText ?? `${title}\n\n${body}`,
    canonicalHash: overrides.canonicalHash ?? "hash",
  };
}

describe("scoreLeadHeuristically", () => {
  it("rejects posts that mention profile technologies without hiring or paid work intent", () => {
    const result = scoreLeadHeuristically(
      lead({
        title: "React, Next.js, Node.js and TypeScript project architecture",
        body: "What stack would you use for a SaaS dashboard with Supabase and Prisma?",
        rawText:
          "React, Next.js, Node.js and TypeScript project architecture\n\nWhat stack would you use for a SaaS dashboard with Supabase and Prisma?",
      })
    );

    expect(result.passed).toBe(false);
    expect(result.rejectionReasons).toContain(
      "No explicit buyer, hiring, or paid-work intent"
    );
  });

  it("passes explicit paid buyer-side posts that match the profile", () => {
    const result = scoreLeadHeuristically(
      lead({
        title: "[Hiring] Need a full-stack TypeScript developer for MVP",
        body: "Paid contract. Looking for someone to build a Next.js app with Supabase and Stripe. Budget $3000. Remote.",
        rawText:
          "[Hiring] Need a full-stack TypeScript developer for MVP\n\nPaid contract. Looking for someone to build a Next.js app with Supabase and Stripe. Budget $3000. Remote.",
      })
    );

    expect(result.passed).toBe(true);
  });

  it("passes custom Next.js storefront hiring posts that request portfolio links", () => {
    const result = scoreLeadHeuristically(
      lead({
        title: "Hiring Next.js Developer",
        body: "We are looking for an experienced full-stack Next.js developer to build an eyeglasses online store. Required stack: Next.js, Tailwind CSS, Supabase, and Stripe. The website should include product pages, shopping cart, Stripe payment integration, full admin dashboard, and responsive mobile and desktop design. Please send your portfolio, GitHub profile URL, live storefront URL, completion timeline, and fixed-price bid in USD. No Shopify websites please.",
        rawText:
          "Hiring Next.js Developer\n\nWe are looking for an experienced full-stack Next.js developer to build an eyeglasses online store. Required stack: Next.js, Tailwind CSS, Supabase, and Stripe. The website should include product pages, shopping cart, Stripe payment integration, full admin dashboard, and responsive mobile and desktop design. Please send your portfolio, GitHub profile URL, live storefront URL, completion timeline, and fixed-price bid in USD. No Shopify websites please.",
      })
    );

    expect(result.passed).toBe(true);
  });

  it("passes posts looking for reliable freelancers for ongoing app work", () => {
    const result = scoreLeadHeuristically(
      lead({
        title:
          "[Hiring] remote freelancers for ongoing projects — paid per weekly",
        body: "Looking for reliable freelancers to develop and maintain modern web and mobile applications. Build a full-stack JavaScript application using Node.js, Express, and React. Salary: $20 - 30 per hour via CashApp, Wise.",
        rawText:
          "[Hiring] remote freelancers for ongoing projects — paid per weekly\n\nLooking for reliable freelancers to develop and maintain modern web and mobile applications. Build a full-stack JavaScript application using Node.js, Express, and React. Salary: $20 - 30 per hour via CashApp, Wise.",
      })
    );

    expect(result.passed).toBe(true);
  });

  it("passes posts onboarding freelance developers for recurring fixes", () => {
    const result = scoreLeadHeuristically(
      lead({
        title:
          "[Hiring] Remote Freelance Developers Needed for Layout and Bug Fixes – $200/Day",
        body: "Our team is looking to onboard freelance developers to handle recurring application updates and fix outstanding software bugs. This contract position is fully remote and offers consistent task pipelines.",
        rawText:
          "[Hiring] Remote Freelance Developers Needed for Layout and Bug Fixes – $200/Day\n\nOur team is looking to onboard freelance developers to handle recurring application updates and fix outstanding software bugs. This contract position is fully remote and offers consistent task pipelines.",
      })
    );

    expect(result.passed).toBe(true);
  });

  it("passes remote developer position posts with full-stack and backend needs", () => {
    const result = scoreLeadHeuristically(
      lead({
        title: "[Hiring] Remote Developers — Full Stack & Go/DevOps",
        body: "We’re hiring for two remote developer positions for an early-stage SaaS product. Full Stack Developer for modern web applications, frontend workflows, backend APIs, and product features end-to-end. Backend / DevOps-Focused Developer with REST APIs and Docker / CI/CD basics.",
        rawText:
          "[Hiring] Remote Developers — Full Stack & Go/DevOps\n\nWe’re hiring for two remote developer positions for an early-stage SaaS product. Full Stack Developer for modern web applications, frontend workflows, backend APIs, and product features end-to-end. Backend / DevOps-Focused Developer with REST APIs and Docker / CI/CD basics.",
      })
    );

    expect(result.passed).toBe(true);
  });

  it("rejects buyer-side posts that do not match the target work profile", () => {
    const result = scoreLeadHeuristically(
      lead({
        title: "[Hiring] Enterprise sales rep, fully remote",
        body: "W2 role with base salary and residuals. US only. Looking for outbound sales experience.",
        rawText:
          "[Hiring] Enterprise sales rep, fully remote\n\nW2 role with base salary and residuals. US only. Looking for outbound sales experience.",
      })
    );

    expect(result.passed).toBe(false);
    expect(result.rejectionReasons).toContain(
      "No strong match for target roles or technical profile"
    );
  });

  it("rejects proxy communication roles that only mention software development", () => {
    const result = scoreLeadHeuristically(
      lead({
        title:
          "[Hiring] Native English speaker with software development experience",
        body: "Part-time paid role joining calls and communicating with clients on behalf of our developer.",
        rawText:
          "[Hiring] Native English speaker with software development experience\n\nPart-time paid role joining calls and communicating with clients on behalf of our developer.",
      })
    );

    expect(result.passed).toBe(false);
    expect(result.rejectionReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Hard reject pattern matched"),
      ])
    );
  });
});
