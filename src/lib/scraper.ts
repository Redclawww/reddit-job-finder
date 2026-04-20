import * as cheerio from 'cheerio';
import puppeteer, { Browser } from 'puppeteer';
import { IScraper } from '../types/interfaces';
import { RedditPost, HttpClientOptions } from '../types';

export function extractPostsFromHtml(
  html: string,
  subredditName: string
): RedditPost[] {
  const $ = cheerio.load(html);
  const extractedPosts: RedditPost[] = [];

  $('.thing').each((_index, element) => {
    try {
      const postElement = $(element);
      const fullname = postElement.attr('data-fullname');
      if (!fullname) {
        return;
      }

      const id = fullname.replace('t3_', '');
      const titleElement = postElement.find('p.title a.title').first();
      const title = titleElement.text().trim();
      if (!title) {
        return;
      }

      const author =
        postElement.find('.author').first().text().trim() || '[deleted]';
      const flair =
        postElement.find('.linkflairlabel').first().text().trim() || undefined;

      let permalink = titleElement.attr('href') || '';
      if (permalink.startsWith('/r/')) {
        permalink = `https://www.reddit.com${permalink}`;
      } else if (permalink.startsWith('http')) {
        const commentsLink =
          postElement.find('.comments').first().attr('href') || '';
        if (commentsLink) {
          permalink = commentsLink.startsWith('http')
            ? commentsLink
            : `https://www.reddit.com${commentsLink}`;
        }
      }

      const scoreText = postElement.find('.score.unvoted').first().text().trim();
      let score = 0;
      if (scoreText && scoreText !== '•') {
        score = parseInt(scoreText.replace(/[^\d-]/g, ''), 10) || 0;
      }

      const commentsText =
        postElement.find('.comments').first().text().trim() || '';
      const commentsCount = parseInt(commentsText.replace(/[^\d]/g, ''), 10) || 0;

      let createdUtc = Date.now() / 1000;
      const datetime = postElement.find('time').first().attr('datetime');
      if (datetime) {
        const parsedDate = new Date(datetime).getTime();
        if (!Number.isNaN(parsedDate)) {
          createdUtc = parsedDate / 1000;
        }
      }

      const linkUrl = titleElement.attr('href') || '';
      const body =
        postElement.find('.expando .usertext-body').first().text().trim() ||
        undefined;
      const post: RedditPost = {
        id,
        title,
        ...(body && { body }),
        ...(flair && { flair }),
        author,
        permalink,
        subreddit: subredditName,
        score,
        commentsCount,
        createdUtc,
      };

      if (linkUrl.startsWith('http') && !linkUrl.includes('reddit.com')) {
        post.url = linkUrl;
        try {
          post.outboundDomain = new URL(linkUrl).hostname;
        } catch (_error) {
          // Ignore malformed external URLs and keep the post.
        }
      }

      extractedPosts.push(post);
    } catch (error) {
      console.warn('Error parsing post:', error);
    }
  });

  return extractedPosts;
}

export class RedditScraper implements IScraper {
  private browser: Browser | null = null;
  private options: HttpClientOptions;

  constructor(options: HttpClientOptions) {
    this.options = options;
  }

  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-blink-features=AutomationControlled',
        ],
      });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scrapeSubreddit(
    subreddit: string,
    _correlationId: string
  ): Promise<RedditPost[]> {
    await this.init();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();

    try {
      // Set user agent and viewport
      await page.setUserAgent(this.options.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to subreddit
      const url = `https://old.reddit.com/r/${subreddit}/new/`;
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      const status = response?.status();
      if (status && status >= 400) {
        throw new Error(`HTTP ${status}`);
      }

      const html = await page.content();
      return extractPostsFromHtml(html, subreddit);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to scrape subreddit ${subreddit}: ${errorMessage}`
      );
    } finally {
      await page.close();
    }
  }
}
