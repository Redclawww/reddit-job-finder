import { AppDatabase } from "./sqlite";
import { CanonicalLead, FinalLeadScore } from "../leads/types";

export class LeadRepository {
  constructor(private readonly db: AppDatabase) {}

  hasLead(id: string, canonicalHash: string): boolean {
    const row = this.db
      .prepare(
        `
        SELECT id FROM leads
        WHERE id = ? OR canonical_hash = ?
        LIMIT 1
        `
      )
      .get(id, canonicalHash);

    return Boolean(row);
  }

  insertLead(lead: CanonicalLead): void {
    this.db
      .prepare(
        `
        INSERT OR IGNORE INTO leads (
          id,
          source,
          source_id,
          source_url,
          title,
          body,
          author,
          subreddit,
          flair,
          created_at,
          collected_at,
          canonical_hash,
          raw_text,
          json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        lead.id,
        lead.source,
        lead.sourceId,
        lead.sourceUrl,
        lead.title,
        lead.body,
        lead.author ?? null,
        lead.subreddit ?? null,
        lead.flair ?? null,
        lead.createdAt,
        lead.collectedAt,
        lead.canonicalHash,
        lead.rawText,
        JSON.stringify(lead)
      );
  }

  insertScore(score: FinalLeadScore): void {
    this.db
      .prepare(
        `
        INSERT OR REPLACE INTO lead_scores (
          lead_id,
          heuristic_score,
          ai_score,
          freshness_score,
          competition_score,
          final_score,
          reasons_json,
          concerns_json,
          suggested_reply,
          scored_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        score.leadId,
        score.heuristicScore,
        score.aiScore ?? null,
        score.freshnessScore,
        score.competitionScore,
        score.finalScore,
        JSON.stringify(score.reasons),
        JSON.stringify(score.concerns),
        score.suggestedReply ?? null,
        new Date().toISOString()
      );
  }

  insertNotification(
    leadId: string,
    channel: "discord",
    status: "sent" | "failed",
    error?: string
  ): void {
    this.db
      .prepare(
        `
        INSERT INTO notifications (
          lead_id,
          channel,
          sent_at,
          status,
          error
        ) VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(
        leadId,
        channel,
        new Date().toISOString(),
        status,
        error ?? null
      );
  }
}
