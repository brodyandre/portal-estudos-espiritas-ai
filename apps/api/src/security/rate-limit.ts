export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

type NowProvider = () => number;

const defaultNowProvider: NowProvider = () => Date.now();

export class MemorySlidingWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();
  private nowProvider: NowProvider = defaultNowProvider;
  private operationCount = 0;

  peek(key: string, policy: RateLimitPolicy): RateLimitDecision {
    const now = this.nowProvider();
    const entry = this.getPrunedEntry(key, policy, now);

    if (!entry || entry.timestamps.length < policy.limit) {
      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    }

    const oldestTimestamp = entry.timestamps[0] ?? now;
    const retryAfterMs = Math.max(0, oldestTimestamp + policy.windowMs - now);

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  record(key: string, policy: RateLimitPolicy): void {
    const now = this.nowProvider();
    const entry = this.getPrunedEntry(key, policy, now);

    if (!entry) {
      this.entries.set(key, { timestamps: [now] });
      this.maybePruneAll(policy, now);
      return;
    }

    entry.timestamps.push(now);
    this.maybePruneAll(policy, now);
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  resetAll(): void {
    this.entries.clear();
    this.operationCount = 0;
    this.restoreDefaultNowProvider();
  }

  setNowProvider(nowProvider: NowProvider): void {
    this.nowProvider = nowProvider;
  }

  restoreDefaultNowProvider(): void {
    this.nowProvider = defaultNowProvider;
  }

  getEntryCount(): number {
    return this.entries.size;
  }

  private getPrunedEntry(key: string, policy: RateLimitPolicy, now: number): RateLimitEntry | null {
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    entry.timestamps = entry.timestamps.filter((timestamp) => timestamp > now - policy.windowMs);

    if (entry.timestamps.length === 0) {
      this.entries.delete(key);
      return null;
    }

    return entry;
  }

  private maybePruneAll(policy: RateLimitPolicy, now: number) {
    this.operationCount += 1;

    if (this.operationCount % 100 !== 0) {
      return;
    }

    for (const [key, entry] of this.entries.entries()) {
      entry.timestamps = entry.timestamps.filter((timestamp) => timestamp > now - policy.windowMs);

      if (entry.timestamps.length === 0) {
        this.entries.delete(key);
      }
    }
  }
}
