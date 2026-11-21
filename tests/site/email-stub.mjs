import http from "node:http";

const port = Number(process.argv[2] ?? 8789);

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/emails") {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "stub-email-id" }));
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(port, "127.0.0.1");
