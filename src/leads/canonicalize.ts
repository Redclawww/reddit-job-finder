import { RawRedditPost, CanonicalLead } from "./types";
import { sha256 } from "../utils/hash";

export function canonicalizeRedditPost(post: RawRedditPost): CanonicalLead {
  const rawText = [post.title, post.body].filter(Boolean).join("\n\n");

  const canonicalHash = sha256(
    [
      "reddit",
      post.title.trim().toLowerCase(),
      post.body?.trim().toLowerCase() ?? "",
      post.permalink,
    ].join("|")
  );

  return {
    id: post.id,
    source: "reddit",
    sourceId: post.id,
    sourceUrl: post.permalink,
    title: post.title,
    body: post.body ?? "",
    author: post.author,
    createdAt: post.createdAt,
    collectedAt: new Date().toISOString(),

    subreddit: post.subreddit,
    flair: post.flair,

    opportunityType: "unknown",
    techStack: [],
    engagement: {
      score: post.score,
      comments: post.comments,
    },

    rawText,
    canonicalHash,
  };
}
