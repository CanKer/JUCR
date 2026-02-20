import http from "http";
import { URL } from "url";

/**
 * Minimal fake OpenChargeMap server for E2E.
 * - GET /poi?limit=...&offset=...
 * Returns a deterministic array of POIs.
 *
 * You can extend it to expose multiple datasets (small/large/update) via query param `dataset`.
 */
const port = Number(process.env.FAKE_OCM_PORT ?? 3999);

const makePoi = (id: number) => ({
  ID: id,
  DateLastStatusUpdate: new Date().toISOString(),
  AddressInfo: { Title: `POI ${id}` }
});

const datasets: Record<string, number> = {
  small: 25,
  large: 1500
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  if (url.pathname !== "/poi") {
    res.writeHead(404);
    return res.end();
  }

  const dataset = url.searchParams.get("dataset") ?? "small";
  const total = datasets[dataset] ?? datasets.small;

  const limit = Number(url.searchParams.get("limit") ?? "100");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const end = Math.min(total, offset + limit);
  const items = [];
  for (let i = offset + 1; i <= end; i += 1) items.push(makePoi(i));

  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(items));
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Fake OCM server on http://localhost:${port}`);
});
