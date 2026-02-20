import { retry } from "../../src/shared/retry/retry";

describe("retry", () => {
  it("retries transient failures then succeeds", async () => {
    let n = 0;
    const result = await retry(async () => {
      n += 1;
      if (n < 3) {
        const err: any = new Error("boom");
        err.status = 503;
        throw err;
      }
      return "ok";
    }, {
      retries: 5,
      minDelayMs: 1,
      maxDelayMs: 5,
      shouldRetry: (e) => (e as any)?.status >= 500
    });

    expect(result).toBe("ok");
    expect(n).toBe(3);
  });
});
