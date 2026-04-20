import { Database } from 'sqlite3';
import { IStore } from '../../types/interfaces';
import * as path from 'path';
import * as fs from 'fs';

export class SqliteStore implements IStore {
  private db: Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = './data/seen_posts.db') {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Create table if it doesn't exist
        this.db!.run(
          `CREATE TABLE IF NOT EXISTS seen_posts (
            id TEXT PRIMARY KEY,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
    });
  }

  async hasSeen(postId: string): Promise<boolean> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT id FROM seen_posts WHERE id = ?',
        [postId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!row);
          }
        }
      );
    });
  }

  async markSeen(postId: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      this.db!.run(
        'INSERT OR IGNORE INTO seen_posts (id) VALUES (?)',
        [postId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async cleanup(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      // Clean up posts older than 30 days
      this.db!.run(
        `DELETE FROM seen_posts 
         WHERE created_at < datetime('now', '-30 days')`,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async close(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      this.db!.close(() => {
        this.db = null;
        resolve();
      });
    });
  }
}
