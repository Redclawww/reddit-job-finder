export const migrations = [
  `
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    author TEXT,
    subreddit TEXT,
    flair TEXT,
    created_at TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    canonical_hash TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    json TEXT NOT NULL
  );
  `,

  `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_canonical_hash
  ON leads(canonical_hash);
  `,

  `
  CREATE TABLE IF NOT EXISTS lead_scores (
    lead_id TEXT PRIMARY KEY,
    heuristic_score REAL NOT NULL,
    ai_score REAL,
    freshness_score REAL NOT NULL,
    competition_score REAL NOT NULL,
    final_score REAL NOT NULL,
    reasons_json TEXT NOT NULL,
    concerns_json TEXT NOT NULL,
    suggested_reply TEXT,
    scored_at TEXT NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  );
  `,

  `
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  );
  `,

  `
  CREATE TABLE IF NOT EXISTS source_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    fetched_count INTEGER DEFAULT 0,
    new_count INTEGER DEFAULT 0,
    matched_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0
  );
  `,
];
