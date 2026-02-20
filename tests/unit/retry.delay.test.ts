import { retry } from "../../src/shared/retry/retry";

describe("retry custom delay", () => {
  it("uses custom delay provided by retry decision", async () => {
    let attempts = 0;
    const delays: number[] = [];
    const result = await retry(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("retry-me");
      }
      return "ok";
    }, {
      retries: 3,
      minDelayMs: 1,
      maxDelayMs: 10,
      shouldRetry: () => ({ retry: true, delayMs: 7 }),
      randomFn: () => 0,
      onRetry: ({ delayMs }) => {
        delays.push(delayMs);
      }
    });

    expect(result).toBe("ok");
    expect(attempts).toBe(2);
    expect(delays).toEqual([7]);
  });

  it("supports object decision with retry=false", async () => {
    let attempts = 0;
    await expect(retry(async () => {
      attempts += 1;
      throw new Error("fatal");
    }, {
      retries: 3,
      minDelayMs: 1,
      maxDelayMs: 10,
      shouldRetry: () => ({ retry: false })
    })).rejects.toThrow("fatal");

    expect(attempts).toBe(1);
  });

  it("allows disabling jitter for deterministic timing-sensitive tests", async () => {
    let attempts = 0;
    const delays: number[] = [];

    await retry(async () => {
      attempts += 1;
      if (attempts <= 2) {
        throw new Error("retry-me");
      }
      return "ok";
    }, {
      retries: 3,
      minDelayMs: 5,
      maxDelayMs: 50,
      shouldRetry: () => true,
      jitterRatio: 0,
      randomFn: () => 0.99,
      onRetry: ({ delayMs }) => {
        delays.push(delayMs);
      }
    });

    expect(delays).toEqual([5, 10]);
  });
});
