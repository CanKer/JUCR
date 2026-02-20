/**
 * A tiny concurrency limiter (no external deps).
 * Usage:
 *   const limit = createLimiter(10);
 *   await Promise.all(items.map(i => limit(() => doWork(i))));
 */
export const createLimiter = (concurrency: number) => {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("concurrency must be an integer >= 1");
  }

  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= concurrency) return;
    const fn = queue.shift();
    if (!fn) return;
    active += 1;
    fn();
  };

  return async <T>(task: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          active -= 1;
          next();
        }
      });
      next();
    });
  };
};
