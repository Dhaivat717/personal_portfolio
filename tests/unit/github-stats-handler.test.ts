import { describe, expect, it } from "vitest";
import { handleGitHubStats, type GitHubStatsEnv } from "../../src/api/githubStats";

const BASE_ENV: GitHubStatsEnv = {
  GITHUB_TOKEN: "ghp_test_secret_token",
  GITHUB_API_URL: "https://github.test/graphql",
};

describe("handleGitHubStats", () => {
  it("queries GitHub GraphQL API, returns contributions with 1-hour cache header, and never leaks GITHUB_TOKEN", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    const fakeFetch: typeof fetch = async (input, init) => {
      capturedUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      capturedInit = init;
      return new Response(
        JSON.stringify({
          data: {
            user: {
              contributionsCollection: {
                contributionCalendar: {
                  totalContributions: 412,
                },
              },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const res = await handleGitHubStats(BASE_ENV, { fetch: fakeFetch });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=3600");

    const rawText = await res.text();
    expect(rawText).not.toContain("ghp_");
    expect(JSON.parse(rawText)).toEqual({ contributions: 412 });

    expect(capturedUrl).toBe("https://github.test/graphql");
    expect(capturedInit?.method).toBe("POST");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ghp_test_secret_token");
    const payload = JSON.parse(String(capturedInit?.body));
    expect(payload.query).toContain("totalContributions");
    expect(payload.variables).toEqual({ login: "Dhaivat717" });
  });

  it("returns 503 with no-store when GITHUB_TOKEN is missing or blank without calling fetch", async () => {
    let called = false;
    const fakeFetch: typeof fetch = async () => {
      called = true;
      return new Response("unexpected", { status: 200 });
    };

    for (const token of [undefined, "", "   "]) {
      const res = await handleGitHubStats(
        { ...BASE_ENV, GITHUB_TOKEN: token },
        { fetch: fakeFetch },
      );
      expect(res.status).toBe(503);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(called).toBe(false);
  });

  it("returns 502 without leaking GITHUB_TOKEN on upstream error status, malformed JSON, or missing/invalid contribution field", async () => {
    const cases: Array<[string, Response]> = [
      ["upstream 500", new Response(JSON.stringify({ message: "error" }), { status: 500 })],
      ["malformed JSON", new Response("<html>not json</html>", { status: 200 })],
      ["missing field", new Response(JSON.stringify({ errors: [{ message: "Bad credentials" }] }), { status: 200 })],
      [
        "negative count",
        new Response(
          JSON.stringify({
            data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: -1 } } } },
          }),
          { status: 200 },
        ),
      ],
      [
        "non-numeric count",
        new Response(
          JSON.stringify({
            data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: "412" } } } },
          }),
          { status: 200 },
        ),
      ],
    ];

    for (const [label, response] of cases) {
      const res = await handleGitHubStats(BASE_ENV, { fetch: async () => response });
      expect(res.status, label).toBe(502);
      expect(res.headers.get("cache-control"), label).toBe("no-store");
      const text = await res.text();
      expect(text, label).not.toContain("ghp_");
    }
  });

  it("returns 502 without leaking GITHUB_TOKEN when upstream times out or throws a network error", async () => {
    const hangingFetch: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });

    const timeoutRes = await handleGitHubStats(
      { ...BASE_ENV, GITHUB_TIMEOUT_MS: "25" },
      { fetch: hangingFetch },
    );
    expect(timeoutRes.status).toBe(502);
    expect(timeoutRes.headers.get("cache-control")).toBe("no-store");
    expect(await timeoutRes.text()).not.toContain("ghp_");

    const networkRes = await handleGitHubStats(BASE_ENV, {
      fetch: async () => {
        throw new Error("network failure");
      },
    });
    expect(networkRes.status).toBe(502);
    expect(await networkRes.text()).not.toContain("ghp_");
  });
});
