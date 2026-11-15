import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };

/**
 * The shared icon set: Lucide, by its kebab-case names (e.g. `message-circle`).
 * See https://lucide.dev/icons for the names.
 */
const icons: Record<string, { body: string }> = lucide.icons;
const aliases: Record<string, { parent: string }> = lucide.aliases ?? {};

function resolve(name: string): string | undefined {
  if (name in icons) return name;
  const alias = aliases[name];
  return alias && resolve(alias.parent);
}

/** Whether `name` is an icon in the shared set. */
export function isIconName(name: string): boolean {
  return resolve(name) !== undefined;
}

/** The build error for an icon name that isn't in the set. */
export function notAnIconMessage(name: string): string {
  return `"${name}" is not a Lucide icon name (see https://lucide.dev/icons)`;
}

/** The inner SVG markup (24×24 viewBox) for a known icon name. */
export function iconSvgBody(name: string): string {
  const key = resolve(name);
  if (!key) throw new Error(notAnIconMessage(name));
  return icons[key].body;
}
