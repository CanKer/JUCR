import { createServer } from "../../src/server";

describe("server smoke", () => {
  it("responds with health payload", () => {
    const server = createServer();
    const handler = server.listeners("request")[0] as ((req: unknown, res: unknown) => void) | undefined;

    expect(typeof handler).toBe("function");

    const response = {
      writeHead: jest.fn(),
      end: jest.fn()
    };

    handler?.({}, response);

    expect(response.writeHead).toHaveBeenCalledWith(200, { "content-type": "application/json" });
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ ok: true, message: "JUCR importer scaffold" }));

    server.close();
  });
});
