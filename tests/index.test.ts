const mockScrapeSubreddit = jest.fn();
const mockScraperClose = jest.fn();
const mockBatchAddPosts = jest.fn();
const mockBatchFlush = jest.fn();
const mockBatchCleanup = jest.fn();
const mockBatchProcessorConstructor = jest.fn();
const mockNotify = jest.fn();
const mockStoreHasSeen = jest.fn();
const mockStoreMarkSeen = jest.fn();
const mockStoreCleanup = jest.fn();
const mockStoreClose = jest.fn();
const mockCreateGeminiClient = jest.fn();
const mockCreateOllamaClient = jest.fn();

jest.mock('dotenv', () => ({
  __esModule: true,
  default: {
    config: jest.fn(),
  },
}));

jest.mock('../src/lib/scraper', () => ({
  RedditScraper: jest.fn().mockImplementation(() => ({
    scrapeSubreddit: mockScrapeSubreddit,
    close: mockScraperClose,
  })),
}));

jest.mock('../src/lib/notifier', () => ({
  DiscordNotifier: jest.fn().mockImplementation(() => ({
    notify: mockNotify,
  })),
}));

jest.mock('../src/lib/telegram-notifier', () => ({
  TelegramNotifier: jest.fn().mockImplementation(() => ({
    notify: mockNotify,
  })),
}));

jest.mock('../src/lib/batch-processor', () => ({
  BatchProcessor: jest.fn().mockImplementation((...args) => {
    mockBatchProcessorConstructor(...args);
    return {
      addPosts: mockBatchAddPosts,
      flush: mockBatchFlush,
      cleanup: mockBatchCleanup,
    };
  }),
}));

jest.mock('../src/lib/store/memory-store', () => ({
  MemoryStore: jest.fn().mockImplementation(() => ({
    hasSeen: mockStoreHasSeen,
    markSeen: mockStoreMarkSeen,
    cleanup: mockStoreCleanup,
    close: mockStoreClose,
  })),
}));

jest.mock('../src/lib/store/sqlite-store', () => ({
  SqliteStore: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    hasSeen: mockStoreHasSeen,
    markSeen: mockStoreMarkSeen,
    cleanup: mockStoreCleanup,
    close: mockStoreClose,
  })),
}));

jest.mock('../src/lib/gemini', () => ({
  createGeminiClient: (...args: unknown[]) => mockCreateGeminiClient(...args),
}));

jest.mock('../src/lib/ollama', () => ({
  createOllamaClient: (...args: unknown[]) => mockCreateOllamaClient(...args),
}));

describe('RedditHireNotifier runOnce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScrapeSubreddit.mockResolvedValue([]);
    mockBatchAddPosts.mockResolvedValue([]);
    mockBatchFlush.mockResolvedValue([]);
    mockNotify.mockResolvedValue(undefined);
    mockStoreHasSeen.mockResolvedValue(false);
    mockStoreMarkSeen.mockResolvedValue(undefined);
    mockStoreCleanup.mockResolvedValue(undefined);
    mockStoreClose.mockResolvedValue(undefined);
    mockBatchCleanup.mockReturnValue(undefined);
    mockCreateGeminiClient.mockReturnValue(undefined);
    mockCreateOllamaClient.mockReturnValue(undefined);
  });

  it('cleans up long-lived resources after a single scrape cycle', async () => {
    const { RedditHireNotifier } = await import('../src/index');

    const notifier = new RedditHireNotifier({
      discordWebhookUrl: 'https://discord.com/api/webhooks/1/2',
      metricsEnabled: false,
      subreddits: ['forhire'],
      keywords: ['hiring'],
      storeType: 'memory',
      userAgent: 'test-agent',
      pollIntervalMs: 1000,
      maxRetries: 1,
      backoffMultiplier: 1,
      maxBackoffMs: 1000,
      port: 3000,
      logLevel: 'info',
      logPretty: false,
    });

    await notifier.runOnce();

    expect(mockScraperClose).toHaveBeenCalledTimes(1);
    expect(mockBatchCleanup).toHaveBeenCalledTimes(1);
    expect(mockStoreCleanup).toHaveBeenCalledTimes(1);
    expect(mockStoreClose).toHaveBeenCalledTimes(1);
  });

  it('uses the hosted gemma client instead of ollama for AI scoring', async () => {
    const { RedditHireNotifier } = await import('../src/index');
    const gemmaClient = { scorePost: jest.fn(), scoreBatch: jest.fn() };
    const ollamaClient = { scorePost: jest.fn(), scoreBatch: jest.fn() };

    mockCreateGeminiClient.mockReturnValue(gemmaClient);
    mockCreateOllamaClient.mockReturnValue(ollamaClient);

    new RedditHireNotifier({
      discordWebhookUrl: 'https://discord.com/api/webhooks/1/2',
      metricsEnabled: false,
      subreddits: ['forhire'],
      keywords: ['hiring'],
      storeType: 'memory',
      userAgent: 'test-agent',
      pollIntervalMs: 1000,
      maxRetries: 1,
      backoffMultiplier: 1,
      maxBackoffMs: 1000,
      port: 3000,
      logLevel: 'info',
      logPretty: false,
    });

    expect(mockCreateGeminiClient).toHaveBeenCalledTimes(1);
    expect(mockCreateOllamaClient).not.toHaveBeenCalled();
    expect(mockBatchProcessorConstructor).toHaveBeenCalledWith(
      expect.any(Object),
      gemmaClient,
      expect.any(Array)
    );
  });
});
