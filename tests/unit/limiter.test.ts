import { createLimiter } from "../../src/shared/concurrency/limiter";

describe("createLimiter", () => {
  it("limits concurrency", async () => {
    const limit = createLimiter(2);
    let active = 0;
    let maxActive = 0;

    const work = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active -= 1;
    };

    await Promise.all(Array.from({ length: 10 }, () => limit(work)));
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
