import puppeteer from 'puppeteer';
import {
  extractPostsFromHtml,
  RedditScraper,
} from '../../src/lib/scraper';
import { sampleRedditHTML, expectedPosts } from '../fixtures/reddit-html';
import { HttpClientOptions } from '../../src/types';

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: jest.fn(),
  },
}));

type MockPage = {
  setUserAgent: jest.Mock<Promise<void>, [string]>;
  setViewport: jest.Mock<Promise<void>, [{ width: number; height: number }]>;
  goto: jest.Mock<Promise<{ status: () => number }>, [string, unknown]>;
  content: jest.Mock<Promise<string>, []>;
  close: jest.Mock<Promise<void>, []>;
};

type MockBrowser = {
  newPage: jest.Mock<Promise<MockPage>, []>;
  close: jest.Mock<Promise<void>, []>;
};

const mockedPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;

function createMockPage({
  html = sampleRedditHTML,
  status = 200,
  gotoError,
}: {
  html?: string;
  status?: number;
  gotoError?: Error;
} = {}): MockPage {
  return {
    setUserAgent: jest.fn().mockResolvedValue(undefined),
    setViewport: jest.fn().mockResolvedValue(undefined),
    goto: jest.fn().mockImplementation(async () => {
      if (gotoError) {
        throw gotoError;
      }

      return {
        status: () => status,
      };
    }),
    content: jest.fn().mockResolvedValue(html),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

describe('RedditScraper', () => {
  let scraper: RedditScraper;
  let mockPage: MockPage;
  let mockBrowser: MockBrowser;

  const httpClientOptions: HttpClientOptions = {
    userAgent: 'test-agent',
    maxRetries: 1,
    backoffMultiplier: 1.5,
    maxBackoffMs: 5000,
  };

  beforeEach(() => {
    mockPage = createMockPage();
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };
    mockedPuppeteer.launch.mockResolvedValue(mockBrowser as never);
    scraper = new RedditScraper(httpClientOptions);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractPostsFromHtml', () => {
    it('should parse Reddit HTML correctly', () => {
      expect(extractPostsFromHtml(sampleRedditHTML, 'forhire')).toEqual(
        expectedPosts
      );
    });

    it('should handle empty subreddit pages', () => {
      const emptyHTML = `
        <!DOCTYPE html>
        <html>
        <body>
          <div id="siteTable" class="sitetable linklisting"></div>
        </body>
        </html>
      `;

      expect(extractPostsFromHtml(emptyHTML, 'empty')).toEqual([]);
    });

    it('should skip malformed posts without required fields', () => {
      const malformedHTML = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="thing" data-fullname="t3_test123">
            <p class="title"></p>
          </div>
        </body>
        </html>
      `;

      expect(extractPostsFromHtml(malformedHTML, 'malformed')).toEqual([]);
    });
  });

  describe('scrapeSubreddit', () => {
    it('should configure Puppeteer and parse the loaded page', async () => {
      const posts = await scraper.scrapeSubreddit('forhire', 'test_correlation');

      expect(mockedPuppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: true,
        })
      );
      expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);
      expect(mockPage.setUserAgent).toHaveBeenCalledWith('test-agent');
      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
      });
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://old.reddit.com/r/forhire/new/',
        {
          waitUntil: 'networkidle2',
          timeout: 30000,
        }
      );
      expect(posts).toEqual(expectedPosts);
    });

    it('should handle network errors gracefully', async () => {
      mockPage = createMockPage({ gotoError: new Error('Network error') });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await expect(
        scraper.scrapeSubreddit('forhire', 'test_correlation')
      ).rejects.toThrow('Failed to scrape subreddit forhire: Network error');
    });

    it('should handle 404 responses', async () => {
      mockPage = createMockPage({ status: 404 });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await expect(
        scraper.scrapeSubreddit('nonexistent', 'test_correlation')
      ).rejects.toThrow('Failed to scrape subreddit nonexistent: HTTP 404');
    });
  });
});
