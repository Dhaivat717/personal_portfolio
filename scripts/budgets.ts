import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

export type BudgetCategory = "home" | "projects" | "deepDive";

export interface RouteBudget {
  jsKb: number;
  firstLoadKb: number;
}

export type BudgetsConfig = Record<BudgetCategory, RouteBudget>;

export interface LoadedResource {
  url: string;
  resourceType: string;
  contentType: string;
  compressedBytes: number;
}

export interface BudgetEvaluation {
  category: BudgetCategory;
  jsBytes: number;
  firstLoadBytes: number;
  jsLimitBytes: number;
  firstLoadLimitBytes: number;
  violations: string[];
}

const DEFAULT_BUDGETS_PATH = resolve(import.meta.dirname, "../budgets.json");

export function loadBudgets(path: string = DEFAULT_BUDGETS_PATH): BudgetsConfig {
  return JSON.parse(readFileSync(path, "utf8")) as BudgetsConfig;
}

export function budgetCategoryForRoute(route: string): BudgetCategory | null {
  if (route === "/") return "home";
  if (route === "/projects") return "projects";
  if (/^\/projects\/[^/]+$/.test(route)) return "deepDive";
  return null;
}

/**
 * Compressed byte size of a response body. Already-compressed binary formats
 * (woff2, png, jpeg, webp) are not penalized by gzip header overhead.
 */
export function compressedSize(body: Buffer): number {
  return Math.min(body.byteLength, gzipSync(body).byteLength);
}

function isScriptResource(resource: LoadedResource): boolean {
  return (
    resource.resourceType === "script" ||
    /(?:application|text)\/(?:x-)?javascript/i.test(resource.contentType) ||
    /\.m?js(?:\?|$)/i.test(resource.url)
  );
}

function isClipResource(resource: LoadedResource): boolean {
  return (
    resource.resourceType === "media" ||
    /^video\//i.test(resource.contentType) ||
    /\.(?:mp4|webm)(?:\?|$)/i.test(resource.url)
  );
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function evaluateBudgets(
  category: BudgetCategory,
  resources: readonly LoadedResource[],
  budgets: BudgetsConfig,
): BudgetEvaluation {
  const limit = budgets[category];
  const jsLimitBytes = limit.jsKb * 1024;
  const firstLoadLimitBytes = limit.firstLoadKb * 1024;
  const excludeClips = category !== "home";

  let jsBytes = 0;
  let firstLoadBytes = 0;

  for (const resource of resources) {
    if (excludeClips && isClipResource(resource)) continue;
    firstLoadBytes += resource.compressedBytes;
    if (isScriptResource(resource)) {
      jsBytes += resource.compressedBytes;
    }
  }

  const violations: string[] = [];
  if (jsBytes > jsLimitBytes) {
    violations.push(
      `${category} JS compressed size ${formatKb(jsBytes)} exceeds budget of ${limit.jsKb} KB`,
    );
  }
  if (firstLoadBytes > firstLoadLimitBytes) {
    violations.push(
      `${category} first load compressed size ${formatKb(firstLoadBytes)} exceeds budget of ${limit.firstLoadKb} KB`,
    );
  }

  return {
    category,
    jsBytes,
    firstLoadBytes,
    jsLimitBytes,
    firstLoadLimitBytes,
    violations,
  };
}
