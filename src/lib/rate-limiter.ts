export class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove timestamps outside the current window
    this.timestamps = this.timestamps.filter(
      (timestamp) => now - timestamp < this.windowMs
    );

    return this.timestamps.length < this.maxRequests;
  }

  recordRequest(): void {
    this.timestamps.push(Date.now());
  }

  getWaitTime(): number {
    if (this.canMakeRequest()) {
      return 0;
    }

    const now = Date.now();
    const oldestTimestamp = this.timestamps[0];
    if (!oldestTimestamp) {
      return 0;
    }
    return this.windowMs - (now - oldestTimestamp);
  }
}
