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

describe("OpenChargeMapHttpClient request shape", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("builds /v3/poi path and forwards query params", async () => {
    let receivedUrl = "";
    const server = await startServer((req, res) => {
      receivedUrl = req.url ?? "";
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([]));
    });

    const client = new OpenChargeMapHttpClient(`${server.baseUrl}/v3`, "test");
    await client.fetchPois({
      limit: 7,
      offset: 14,
      modifiedSince: "2026-02-20T00:00:00.000Z",
      dataset: "small"
    });

    const parsed = new URL(receivedUrl, server.baseUrl);
    expect(parsed.pathname).toBe("/v3/poi");
    expect(parsed.searchParams.get("limit")).toBe("7");
    expect(parsed.searchParams.get("offset")).toBe("14");
    expect(parsed.searchParams.get("modifiedsince")).toBe("2026-02-20T00:00:00.000Z");
    expect(parsed.searchParams.get("dataset")).toBe("small");

    await server.close();
  });

  it("supports base URL that already ends with slash", async () => {
    let receivedPath = "";
    const server = await startServer((req, res) => {
      receivedPath = new URL(req.url ?? "", server.baseUrl).pathname;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([]));
    });

    const client = new OpenChargeMapHttpClient(`${server.baseUrl}/v3/`, "test");
    await client.fetchPois({ limit: 1, offset: 0 });

    expect(receivedPath).toBe("/v3/poi");
    await server.close();
  });

  it("throws when API payload is not an array", async () => {
    const server = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });

    const client = new OpenChargeMapHttpClient(server.baseUrl, "test");
    await expect(client.fetchPois({ limit: 1, offset: 0 })).rejects.toThrow("OCM response is not an array");

    await server.close();
  });
});
