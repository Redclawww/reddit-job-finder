import { RawRedditPost } from "../../leads/types";
import { load } from "cheerio";

type RedditListingResponse = {
  data: {
    children: Array<{
      data: {
        id: string;
        subreddit: string;
        title: string;
        selftext?: string;
        author?: string;
        url: string;
        permalink: string;
        created_utc: number;
        score?: number;
        num_comments?: number;
        link_flair_text?: string;
      };
    }>;
  };
};

export class RedditSource {
  constructor(
    private readonly userAgent: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async fetchSubredditNew(
    subreddit: string,
    limit = 25
  ): Promise<RawRedditPost[]> {
    const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;

    const res = await this.fetchImpl(url, {
      headers: {
        "User-Agent": this.userAgent,
      },
    });

    if (!res.ok) {
      if (res.status === 403) {
        return this.fetchSubredditRss(subreddit);
      }

      throw new Error(
        `Failed to fetch r/${subreddit}: ${res.status} ${res.statusText}`
      );
    }

    const json = (await res.json()) as RedditListingResponse;

    return json.data.children.map((child) => {
      const post = child.data;

      return {
        id: `reddit:${post.id}`,
        subreddit: post.subreddit,
        title: post.title ?? "",
        body: post.selftext ?? "",
        author: post.author,
        url: post.url,
        permalink: `https://www.reddit.com${post.permalink}`,
        createdAt: new Date(post.created_utc * 1000).toISOString(),
        score: post.score,
        comments: post.num_comments,
        flair: post.link_flair_text,
        raw: post,
      };
    });
  }

  private async fetchSubredditRss(subreddit: string): Promise<RawRedditPost[]> {
    const url = `https://www.reddit.com/r/${subreddit}/.rss`;
    const res = await this.fetchImpl(url, {
      headers: {
        "User-Agent": this.userAgent,
      },
    });

    if (!res.ok) {
      throw new Error(
        `Failed to fetch r/${subreddit}: ${res.status} ${res.statusText}`
      );
    }

    const xml = await res.text();
    const $ = load(xml, { xmlMode: true });

    return $("entry")
      .toArray()
      .map((entry) => {
        const node = $(entry);
        const id = normalizeRedditId(node.children("id").first().text());
        const permalink = node.children("link").first().attr("href") ?? "";
        const createdAtText =
          node.children("updated").first().text() ||
          node.children("published").first().text();

        return {
          id: `reddit:${id}`,
          subreddit,
          title: node.children("title").first().text() ?? "",
          body:
            node.children("content").first().text() ||
            node.children("summary").first().text() ||
            "",
          author: node.find("author > name").first().text() || undefined,
          url: permalink,
          permalink,
          createdAt: createdAtText
            ? new Date(createdAtText).toISOString()
            : new Date().toISOString(),
          raw: $.xml(entry),
        };
      });
  }

  async fetchManySubreddits(
    subreddits: string[],
    limitPerSubreddit = 25
  ): Promise<RawRedditPost[]> {
    const allPosts: RawRedditPost[] = [];

    for (const subreddit of subreddits) {
      try {
        const posts = await this.fetchSubredditNew(
          subreddit,
          limitPerSubreddit
        );

        allPosts.push(...posts);

        // Small delay to avoid hammering Reddit.
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (error) {
        console.error(`[reddit] Failed r/${subreddit}`, error);
      }
    }

    return allPosts;
  }
}

function normalizeRedditId(id: string): string {
  return id.trim().replace(/^t3_/, "");
}
