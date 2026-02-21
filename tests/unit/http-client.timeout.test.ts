import http from "http";
import type { AddressInfo } from "net";
import type { RetryOptions } from "../../src/shared/retry/retry";
import { OpenChargeMapHttpClient } from "../../src/infrastructure/openchargemap/OpenChargeMapHttpClient";

jest.mock("../../src/shared/retry/retry", () => {
  const actual = jest.requireActual("../../src/shared/retry/retry") as typeof import("../../src/shared/retry/retry");
  return {
    ...actual,
    retry: <T>(fn: () => Promise<T>, opts: RetryOptions) =>
      actual.retry(fn, {
        ...opts,
        minDelayMs: 20,
        maxDelayMs: 80,
        jitterRatio: 0
      })
  };
});

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

describe("OpenChargeMapHttpClient timeout handling", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("retries timed out requests and eventually succeeds", async () => {
    let requests = 0;

    const server = await startServer((_req, res) => {
      requests += 1;
      if (requests <= 2) {
        setTimeout(() => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify([{ ID: 1, AddressInfo: { Title: "POI 1" } }]));
        }, 80);
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([{ ID: 1, AddressInfo: { Title: "POI 1" } }]));
    });

    const client = new OpenChargeMapHttpClient(server.baseUrl, "test", 20);
    const pois = await client.fetchPois({ limit: 10, offset: 0 });

    expect(pois).toHaveLength(1);
    expect(requests).toBe(3);

    await server.close();
  });

  it("retries timed out requests and fails after max attempts", async () => {
    let requests = 0;

    const server = await startServer((_req, res) => {
      requests += 1;
      setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify([{ ID: 1, AddressInfo: { Title: "POI 1" } }]));
      }, 80);
    });

    const client = new OpenChargeMapHttpClient(server.baseUrl, "test", 10);

    await expect(client.fetchPois({ limit: 10, offset: 0 })).rejects.toThrow(
      "OCM request timeout after 10ms"
    );
    expect(requests).toBe(6);

    await server.close();
  });
});
