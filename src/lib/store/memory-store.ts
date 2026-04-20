import { IStore } from '../../types/interfaces';

export class MemoryStore implements IStore {
  private seenPosts: Set<string> = new Set();

  async hasSeen(postId: string): Promise<boolean> {
    return this.seenPosts.has(postId);
  }

  async markSeen(postId: string): Promise<void> {
    this.seenPosts.add(postId);
  }

  async cleanup(): Promise<void> {
    // Optional: implement LRU eviction if memory becomes an issue
    // For now, keep all seen posts in memory
  }

  // Helper method for testing
  clear(): void {
    this.seenPosts.clear();
  }

  size(): number {
    return this.seenPosts.size;
  }
}
