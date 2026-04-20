export interface IScraper {
  scrapeSubreddit(
    subreddit: string,
    correlationId: string
  ): Promise<RedditPost[]>;
}

export interface IMatcher {
  findMatches(
    posts: RedditPost[],
    correlationId: string
  ): Promise<MatchResult[]>;
}

export interface INotifier {
  notify(match: MatchResult, correlationId: string): Promise<void>;
}

export interface IStore {
  hasSeen(postId: string): Promise<boolean>;
  markSeen(postId: string): Promise<void>;
  cleanup?(): Promise<void>;
}

export interface IGeminiClient {
  scorePost(post: RedditPost, correlationId: string): Promise<GeminiResponse>;
  scoreBatch(
    posts: RedditPost[],
    correlationId: string
  ): Promise<Array<{ post: RedditPost; response: GeminiResponse }>>;
}

export interface IHttpClient {
  get(url: string, options?: RequestOptions): Promise<HttpResponse>;
  post(
    url: string,
    data: unknown,
    options?: RequestOptions
  ): Promise<HttpResponse>;
}

import {
  RedditPost,
  MatchResult,
  GeminiResponse,
  HttpResponse,
  RequestOptions,
} from './index';
