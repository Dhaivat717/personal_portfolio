import { extractGraphQLContributions } from "../../src/githubStats";
import { site } from "../../src/settings";

interface Env {
  GITHUB_TOKEN?: string;
  GITHUB_API_URL?: string;
  GITHUB_TIMEOUT_MS?: string;
}

const DEFAULT_GITHUB_API_URL = "https://api.github.com/graphql";
const DEFAULT_TIMEOUT_MS = 4_000;
const CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";
const GITHUB_LOGIN = new URL(site.social.github).pathname.replace(/^\/+|\/+$/g, "");

const CONTRIBUTIONS_QUERY = `
  query Contributions($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
        }
      }
    }
  }
`;

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const token = env.GITHUB_TOKEN?.trim();
  if (!token) {
    return jsonError(503, "GitHub stats are not configured.");
  }

  const apiUrl = env.GITHUB_API_URL?.trim() || DEFAULT_GITHUB_API_URL;
  const parsedTimeout = Number.parseInt(env.GITHUB_TIMEOUT_MS ?? "", 10);
  const timeoutMs =
    Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "personal-portfolio",
      },
      body: JSON.stringify({
        query: CONTRIBUTIONS_QUERY,
        variables: { login: GITHUB_LOGIN },
      }),
      signal: controller.signal,
    });
  } catch {
    return jsonError(502, "Failed to reach GitHub API.");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    return jsonError(502, "GitHub API returned an error.");
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return jsonError(502, "Invalid response from GitHub API.");
  }

  const contributions = extractGraphQLContributions(payload);
  if (contributions === null) {
    return jsonError(502, "Missing contribution count in GitHub response.");
  }

  return new Response(JSON.stringify({ contributions }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": CACHE_CONTROL,
    },
  });
};
