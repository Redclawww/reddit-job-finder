import { CanonicalLead, FinalLeadScore } from "../leads/types";
import { buildDiscordEmbed } from "./templates";

export class DiscordNotifier {
  constructor(private readonly webhookUrl: string) {}

  async sendLead(lead: CanonicalLead, score: FinalLeadScore): Promise<void> {
    const embed = buildDiscordEmbed(lead, score);

    const res = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "Reddit Hire Notifier",
        embeds: [embed],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Discord webhook failed: ${res.status} ${res.statusText} ${text}`
      );
    }
  }
}
