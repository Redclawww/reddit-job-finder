import { CanonicalLead, FinalLeadScore } from "../leads/types";

export function buildDiscordEmbed(lead: CanonicalLead, score: FinalLeadScore) {
  const percent = Math.round(score.finalScore * 100);

  return {
    title: `🔥 ${percent}% Match: ${lead.title}`.slice(0, 256),
    url: lead.sourceUrl,
    description: buildDescription(lead, score).slice(0, 4096),
    color: score.finalScore >= 0.85 ? 0x2ecc71 : 0xf1c40f,
    fields: [
      {
        name: "Source",
        value: `r/${lead.subreddit ?? "unknown"}`,
        inline: true,
      },
      {
        name: "Type",
        value: lead.opportunityType,
        inline: true,
      },
      {
        name: "Competition",
        value: `${lead.engagement.comments ?? 0} comments`,
        inline: true,
      },
      {
        name: "Tech",
        value: lead.techStack.length
          ? lead.techStack.slice(0, 8).join(", ")
          : "Unknown",
        inline: false,
      },
      {
        name: "Why it matches",
        value: score.reasons.length
          ? score.reasons.slice(0, 5).join("\n")
          : "No reasons provided",
        inline: false,
      },
      {
        name: "Concerns",
        value: score.concerns.length
          ? score.concerns.slice(0, 5).join("\n")
          : "None",
        inline: false,
      },
    ],
    footer: {
      text: `Reddit Hire Notifier • ${new Date().toLocaleString()}`,
    },
  };
}

function buildDescription(lead: CanonicalLead, score: FinalLeadScore): string {
  const chunks: string[] = [];

  chunks.push(`**Score:** ${Math.round(score.finalScore * 100)}%`);

  if (lead.budget) {
    chunks.push(
      `**Budget:** ${lead.budget.currency ?? ""} ${lead.budget.min ?? "?"}${
        lead.budget.period ? ` / ${lead.budget.period}` : ""
      }`
    );
  }

  if (lead.contactMethod) {
    chunks.push(`**Contact:** ${lead.contactMethod}`);
  }

  if (lead.body) {
    chunks.push(`**Post Preview:**\n${lead.body.slice(0, 700)}`);
  }

  if (score.suggestedReply) {
    chunks.push(`**Suggested Reply:**\n${score.suggestedReply.slice(0, 900)}`);
  }

  return chunks.join("\n\n");
}
