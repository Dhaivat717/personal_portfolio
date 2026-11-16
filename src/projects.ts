import { getCollection, type CollectionEntry } from "astro:content";

export type Project = CollectionEntry<"projects">;

/**
 * Every Personal project a Visitor should see, lowest `order` first.
 * Pages read projects only through this, so ordering is the same everywhere.
 *
 * Drafts are included only when drafts are shown (see `showDrafts`); otherwise
 * they are absent entirely: no page and no row.
 *
 * Fails the build if two projects share an `order`.
 */
export async function getProjects(): Promise<Project[]> {
  const all = await getCollection("projects");
  assertUniqueOrder(all);
  const includeDrafts = showDrafts();
  return all.filter((p) => includeDrafts || !p.data.draft).sort((a, b) => a.data.order - b.data.order);
}

/** Where a Personal project's Deep dive lives. */
export function projectHref(project: Project): string {
  return `/projects/${project.id}`;
}

/**
 * Drafts render on previews and in local dev. `SITE_ENV=production` (the Pages
 * Production environment) hides them, and `SHOW_DRAFTS=false` forces them off
 * for the CI check build.
 */
function showDrafts(): boolean {
  return process.env.SITE_ENV !== "production" && process.env.SHOW_DRAFTS !== "false";
}

/** Checked across drafts too, so publishing a draft can never cause a clash. */
function assertUniqueOrder(projects: Project[]): void {
  const byOrder = Map.groupBy(projects, (p) => p.data.order);
  const clashes = [...byOrder]
    .filter(([, group]) => group.length > 1)
    .map(([order, group]) => {
      const names = group.map((p) => `"${p.id}"`).sort();
      return `Personal projects ${names.join(" and ")} both use order ${order}.`;
    });
  if (clashes.length > 0) {
    throw new Error(`${clashes.join(" ")} Each project's order must be unique.`);
  }
}
