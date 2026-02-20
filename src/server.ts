import http from "http";

export const createServer = () => {
  return http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: "JUCR importer scaffold" }));
  });
};

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  const server = createServer();

  server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}
