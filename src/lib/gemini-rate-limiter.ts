/**
 * Rate limiter specifically for Gemini API calls
 * Implements token bucket algorithm with burst capacity
 */

export interface GeminiRateLimiterConfig {
  requestsPerMinute: number;
  burstCapacity: number;
}

export class GeminiRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly requestsPerMinute: number;
  private readonly burstCapacity: number;
  private readonly tokensPerMs: number;

  constructor(config: GeminiRateLimiterConfig) {
    this.requestsPerMinute = config.requestsPerMinute;
    this.burstCapacity = config.burstCapacity;
    this.tokensPerMs = this.requestsPerMinute / (60 * 1000); // tokens per millisecond
    this.tokens = this.burstCapacity;
    this.lastRefill = Date.now();
  }

  /**
   * Wait until a token is available for API call
   */
  async waitForToken(): Promise<void> {
    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait time needed
    const timeToNextToken = Math.ceil(1 / this.tokensPerMs);
    await this.sleep(timeToNextToken);

    // Recursively try again
    return this.waitForToken();
  }

  /**
   * Check if we can make a request without waiting
   */
  canMakeRequest(): boolean {
    this.refillTokens();
    return this.tokens >= 1;
  }

  /**
   * Get current token count
   */
  getTokenCount(): number {
    this.refillTokens();
    return this.tokens;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = timePassed * this.tokensPerMs;

    this.tokens = Math.min(this.burstCapacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
