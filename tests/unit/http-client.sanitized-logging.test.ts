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

describe("OpenChargeMapHttpClient sanitized logging", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("logs retry metadata without leaking response body", async () => {
    let requests = 0;
    const secretBody = "super-secret-http-body";
    const server = await startServer((_req, res) => {
      requests += 1;
      if (requests === 1) {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end(secretBody);
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([{ ID: 1, AddressInfo: { Title: "POI 1" } }]));
    });

    const client = new OpenChargeMapHttpClient(server.baseUrl, "test");
    await client.fetchPois({ limit: 10, offset: 0 });

    expect(warnSpy).toHaveBeenCalled();
    const retryLog = JSON.parse(String(warnSpy.mock.calls[0][0])) as Record<string, unknown>;
    expect(retryLog.event).toBe("http.retry");
    expect(retryLog.status).toBe(500);
    expect(retryLog.attempt).toBe(1);
    expect(retryLog.maxAttempts).toBe(6);
    expect(String(retryLog.url)).toContain("/poi");
    expect(JSON.stringify(retryLog)).not.toContain(secretBody);

    await server.close();
  });

  it("logs give-up metadata and does not expose error body on fatal 4xx", async () => {
    const secretBody = "do-not-log-this-body";
    const server = await startServer((_req, res) => {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end(secretBody);
    });

    const client = new OpenChargeMapHttpClient(server.baseUrl, "test");
    let error: (Error & { body?: string }) | undefined;
    try {
      await client.fetchPois({ limit: 1, offset: 0 });
    } catch (err) {
      error = err as Error & { body?: string };
    }

    expect(error).toBeDefined();
    expect(error?.message).toContain("OCM request failed: 400");
    expect(error?.body).toBeUndefined();

    const giveUpLog = JSON.parse(String(warnSpy.mock.calls[0][0])) as Record<string, unknown>;
    expect(giveUpLog.event).toBe("http.give_up");
    expect(giveUpLog.status).toBe(400);
    expect(giveUpLog.attempt).toBe(1);
    expect(giveUpLog.maxAttempts).toBe(6);
    expect(JSON.stringify(giveUpLog)).not.toContain(secretBody);

    await server.close();
  });
});
