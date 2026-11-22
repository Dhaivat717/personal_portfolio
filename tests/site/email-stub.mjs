import http from "node:http";

const port = Number(process.argv[2] ?? 8789);
const capturedGraphql = [];

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "GET" && req.url === "/graphql/captured") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(capturedGraphql));
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

  if (req.method === "POST" && req.url === "/graphql") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      let body = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        // ignore non-json
      }
      capturedGraphql.push({
        method: req.method,
        authorization: req.headers.authorization,
        body,
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            user: {
              contributionsCollection: {
                contributionCalendar: {
                  totalContributions: 30,
                },
              },
            },
          },
        }),
      );
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(port, "127.0.0.1");
