import http from "http";
import type { AddressInfo } from "net";
import { OpenChargeMapHttpClient } from "../../src/infrastructure/openchargemap/OpenChargeMapHttpClient";

type TestServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

const startServer = async (
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<TestServer> => {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      })
  };
};

describe("OpenChargeMapHttpClient Retry-After support", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("respects Retry-After on 429 and eventually succeeds", async () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);
    const timeoutSpy = jest.spyOn(global, "setTimeout");

    let requests = 0;
    const server = await startServer((_req, res) => {
      requests += 1;
      if (requests <= 2) {
        res.writeHead(429, {
          "content-type": "text/plain",
          "Retry-After": "1"
        });
        res.end("rate limited");
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([{ ID: 1, AddressInfo: { Title: "POI 1" } }]));
    });

    const client = new OpenChargeMapHttpClient(server.baseUrl, "test", 5000, 10);
    const pois = await client.fetchPois({ limit: 10, offset: 0 });

    expect(pois).toHaveLength(1);
    expect(requests).toBe(3);
    const usedRetryAfterDelay = timeoutSpy.mock.calls.some((call) => call[1] === 10);
    expect(usedRetryAfterDelay).toBe(true);

    await server.close();
    timeoutSpy.mockRestore();
    randomSpy.mockRestore();
  });

  it.each(["missing", "invalid"] as const)(
    "falls back to normal backoff when Retry-After is %s",
    async (mode) => {
      const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);
      const timeoutSpy = jest.spyOn(global, "setTimeout");

      let requests = 0;
      const server = await startServer((_req, res) => {
        requests += 1;
        if (requests === 1) {
          const headers: Record<string, string> = { "content-type": "text/plain" };
          if (mode === "invalid") headers["Retry-After"] = "NaN";
          res.writeHead(429, headers);
          res.end("rate limited");
          return;
        }

        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify([{ ID: 1, AddressInfo: { Title: "POI 1" } }]));
      });

      const client = new OpenChargeMapHttpClient(server.baseUrl, "test", 5000);
      const pois = await client.fetchPois({ limit: 10, offset: 0 });

      expect(pois).toHaveLength(1);
      expect(requests).toBe(2);

      const usedFallbackBackoff = timeoutSpy.mock.calls.some((call) => call[1] === 250);
      const usedRetryAfterDelay = timeoutSpy.mock.calls.some((call) => call[1] === 1000);
      expect(usedFallbackBackoff).toBe(true);
      expect(usedRetryAfterDelay).toBe(false);

      await server.close();
      timeoutSpy.mockRestore();
      randomSpy.mockRestore();
    }
  );

  it("falls back to normal backoff when Retry-After overflows numeric range", async () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);
    const timeoutSpy = jest.spyOn(global, "setTimeout");

    let requests = 0;
    const server = await startServer((_req, res) => {
      requests += 1;
      if (requests === 1) {
        res.writeHead(429, {
          "content-type": "text/plain",
          "Retry-After": "999999999999999999999999999999999999"
        });
        res.end("rate limited");
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([{ ID: 1, AddressInfo: { Title: "POI 1" } }]));
    });

    const client = new OpenChargeMapHttpClient(server.baseUrl, "test", 5000);
    const pois = await client.fetchPois({ limit: 10, offset: 0 });

    expect(pois).toHaveLength(1);
    expect(requests).toBe(2);
    const usedFallbackBackoff = timeoutSpy.mock.calls.some((call) => call[1] === 250);
    expect(usedFallbackBackoff).toBe(true);

    await server.close();
    timeoutSpy.mockRestore();
    randomSpy.mockRestore();
  });
});
