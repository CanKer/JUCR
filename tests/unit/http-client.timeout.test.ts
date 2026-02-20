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
});
