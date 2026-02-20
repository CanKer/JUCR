import { retry } from "../../src/shared/retry/retry";

describe("retry custom delay", () => {
  it("uses custom delay provided by retry decision", async () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);
    const timeoutSpy = jest.spyOn(global, "setTimeout");

    let attempts = 0;
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
      shouldRetry: () => ({ retry: true, delayMs: 7 })
    });

    expect(result).toBe("ok");
    expect(attempts).toBe(2);
    const usedCustomDelay = timeoutSpy.mock.calls.some((call) => call[1] === 7);
    expect(usedCustomDelay).toBe(true);

    timeoutSpy.mockRestore();
    randomSpy.mockRestore();
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
});
