import http from "node:http";

const port = Number(process.argv[2] ?? 8789);
const capturedGraphql = [];
let graphqlBehavior = {
  mode: "ok",
  contributions: 30,
};

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

  if (req.method === "POST" && req.url === "/graphql/config") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const next = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        graphqlBehavior = {
          mode: typeof next.mode === "string" ? next.mode : "ok",
          contributions: typeof next.contributions === "number" ? next.contributions : 30,
        };
      } catch {
        graphqlBehavior = { mode: "ok", contributions: 30 };
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, graphqlBehavior }));
    });
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

      if (graphqlBehavior.mode === "error") {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: "Internal Server Error" }));
        return;
      }

      if (graphqlBehavior.mode === "malformed") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("<html>not json</html>");
        return;
      }

      if (graphqlBehavior.mode === "missingField") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ errors: [{ message: "Bad credentials" }] }));
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            user: {
              contributionsCollection: {
                contributionCalendar: {
                  totalContributions: graphqlBehavior.contributions,
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
