import { RedditSource } from "../../src/sources/reddit/reddit-source";

describe("RedditSource", () => {
  it("falls back to RSS when Reddit JSON is blocked", async () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <id>t3_abc123</id>
          <title>Hiring a Next.js developer</title>
          <author><name>client-user</name></author>
          <link href="https://www.reddit.com/r/forhire/comments/abc123/hiring/" />
          <updated>2026-05-16T06:00:00+00:00</updated>
          <content>Paid contract for a SaaS MVP.</content>
        </entry>
      </feed>`;

    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response("Blocked", { status: 403 }))
      .mockResolvedValueOnce(
        new Response(rss, {
          status: 200,
          headers: { "Content-Type": "application/atom+xml" },
        })
      );

    const source = new RedditSource("reddit-hire-notifier/1.0", fetchImpl);

    const posts = await source.fetchSubredditNew("forhire", 1);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      "https://www.reddit.com/r/forhire/.rss"
    );
    expect(posts).toEqual([
      expect.objectContaining({
        id: "reddit:abc123",
        subreddit: "forhire",
        title: "Hiring a Next.js developer",
        body: "Paid contract for a SaaS MVP.",
        author: "client-user",
        permalink: "https://www.reddit.com/r/forhire/comments/abc123/hiring/",
      }),
    ]);
  });
});
