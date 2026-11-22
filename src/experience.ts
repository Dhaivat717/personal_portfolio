import type { ImageMetadata } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import amazonLogo from "./assets/logos/amazon.webp";
import invidiLogo from "./assets/logos/invidi.webp";
import rutgersLogo from "./assets/logos/rutgers.webp";

export type ExperienceEntry = CollectionEntry<"experience">;
export type CompanyLogoKey = ExperienceEntry["data"]["logo"];

const COMPANY_LOGOS: Record<CompanyLogoKey, ImageMetadata> = {
  amazon: amazonLogo,
  invidi: invidiLogo,
  rutgers: rutgersLogo,
};

export interface ExperienceRole {
  id: string;
  company: string;
  title: string;
  when: string;
  logoImage: ImageMetadata;
  logoAlt: string;
  bullets: string[];
  tags: string[];
}

export interface BulletSegment {
  text: string;
  bold: boolean;
}

/**
 * Splits a Work highlight bullet into plain and bold (`**...**`) segments so
 * templates can render `<strong>` safely without raw HTML injection.
 */
export function parseBullet(bullet: string): BulletSegment[] {
  const segments: BulletSegment[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;

  for (const match of bullet.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ text: bullet.slice(lastIndex, start), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < bullet.length) {
    segments.push({ text: bullet.slice(lastIndex), bold: false });
  }

  return segments;
}

/** All roles in the Experience Section, ordered newest first by `order`. */
export async function getExperience(): Promise<ExperienceRole[]> {
  const entries = await getCollection("experience");
  return entries
    .toSorted((a, b) => a.data.order - b.data.order)
    .map((entry) => ({
      id: entry.data.id,
      company: entry.data.company,
      title: entry.data.title,
      when: entry.data.when,
      logoImage: COMPANY_LOGOS[entry.data.logo],
      logoAlt: entry.data.logoAlt,
      bullets: entry.data.bullets,
      tags: entry.data.tags,
    }));
}
