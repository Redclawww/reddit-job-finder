import { MemoryStore } from '../../src/lib/store/memory-store';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  afterEach(() => {
    store.clear();
  });

  describe('hasSeen', () => {
    it('should return false for unseen posts', async () => {
      const result = await store.hasSeen('test_post_id');
      expect(result).toBe(false);
    });

    it('should return true for seen posts', async () => {
      await store.markSeen('test_post_id');
      const result = await store.hasSeen('test_post_id');
      expect(result).toBe(true);
    });
  });

  describe('markSeen', () => {
    it('should mark a post as seen', async () => {
      await store.markSeen('test_post_id');
      const result = await store.hasSeen('test_post_id');
      expect(result).toBe(true);
    });

    it('should handle duplicate markings', async () => {
      await store.markSeen('test_post_id');
      await store.markSeen('test_post_id');
      const result = await store.hasSeen('test_post_id');
      expect(result).toBe(true);
      expect(store.size()).toBe(1);
    });
  });

  describe('size', () => {
    it('should return correct size', async () => {
      expect(store.size()).toBe(0);

      await store.markSeen('post1');
      expect(store.size()).toBe(1);

      await store.markSeen('post2');
      expect(store.size()).toBe(2);

      await store.markSeen('post1'); // duplicate
      expect(store.size()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all seen posts', async () => {
      await store.markSeen('post1');
      await store.markSeen('post2');
      expect(store.size()).toBe(2);

      store.clear();
      expect(store.size()).toBe(0);
      expect(await store.hasSeen('post1')).toBe(false);
      expect(await store.hasSeen('post2')).toBe(false);
    });
  });
});
