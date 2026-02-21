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

describe("OpenChargeMapHttpClient retry policy", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("retries on 500 and eventually succeeds", async () => {
    let requests = 0;
    const server = await startServer((_req, res) => {
      requests += 1;
      if (requests < 3) {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("temporary failure");
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([{ ID: 1, AddressInfo: { Title: "POI 1" } }]));
    });

    const client = new OpenChargeMapHttpClient(server.baseUrl, "test");
    const pois = await client.fetchPois({ limit: 10, offset: 0 });

    expect(pois).toHaveLength(1);
    expect(requests).toBe(3);

    await server.close();
  });

  it("retries on transient network errors and eventually succeeds", async () => {
    let requests = 0;
    const server = await startServer((_req, res) => {
      requests += 1;
      if (requests < 3) {
        // Simulate a low-level socket failure so fetch throws (network error path).
        res.socket?.destroy();
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([{ ID: 1, AddressInfo: { Title: "POI 1" } }]));
    });

    const client = new OpenChargeMapHttpClient(server.baseUrl, "test");
    const pois = await client.fetchPois({ limit: 10, offset: 0 });

    expect(pois).toHaveLength(1);
    expect(requests).toBe(3);

    await server.close();
  });

  it("retries on 429", async () => {
    let requests = 0;
    const server = await startServer((_req, res) => {
      requests += 1;
      if (requests < 3) {
        res.writeHead(429, { "content-type": "text/plain" });
        res.end("rate limited");
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([{ ID: 1, AddressInfo: { Title: "POI 1" } }]));
    });

    const client = new OpenChargeMapHttpClient(server.baseUrl, "test");
    const pois = await client.fetchPois({ limit: 10, offset: 0 });

    expect(pois).toHaveLength(1);
    expect(requests).toBe(3);

    await server.close();
  });

  it.each([400, 401, 403, 404, 409, 422])("treats non-429 4xx (%s) as fatal (no retry)", async (status) => {
    let requests = 0;
    const server = await startServer((_req, res) => {
      requests += 1;
      res.writeHead(status, { "content-type": "text/plain" });
      res.end("fatal");
    });

    const client = new OpenChargeMapHttpClient(server.baseUrl, "test");

    let err: (Error & { body?: string }) | undefined;
    try {
      await client.fetchPois({ limit: 10, offset: 0 });
    } catch (error) {
      err = error as Error & { body?: string };
    }
    expect(err).toBeDefined();
    expect(err?.message).toMatch(new RegExp(`OCM request failed: ${status}`));
    expect(err?.body).toBeUndefined();
    expect(requests).toBe(1);

    await server.close();
  });
});
