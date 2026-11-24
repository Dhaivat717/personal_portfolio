import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };

/**
 * The shared icon set: Lucide, by its kebab-case names (e.g. `message-circle`),
 * plus small custom icons in the same 24×24 stroke style when Lucide lacks one.
 * See https://lucide.dev/icons for Lucide names.
 */
const customIcons: Record<string, string> = {
  spider:
    '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">' +
    '<circle cx="12" cy="8.5" r="2.5"/>' +
    '<ellipse cx="12" cy="15.5" rx="3.5" ry="4.5"/>' +
    '<path d="M10 7.2 6.5 3.5 4 5.5"/>' +
    '<path d="M14 7.2 17.5 3.5 20 5.5"/>' +
    '<path d="M9.5 9 5 7.5 2.5 10"/>' +
    '<path d="M14.5 9 19 7.5 21.5 10"/>' +
    '<path d="M9.5 10.5 5 12.5 3 16"/>' +
    '<path d="M14.5 10.5 19 12.5 21 16"/>' +
    '<path d="M10 12 6.5 16.5 5.5 20.5"/>' +
    '<path d="M14 12 17.5 16.5 18.5 20.5"/>' +
    "</g>",
};

const icons: Record<string, { body: string }> = lucide.icons;
const aliases: Record<string, { parent: string }> = lucide.aliases ?? {};

function resolve(name: string): string | undefined {
  if (name in customIcons) return name;
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
  return customIcons[key] ?? icons[key].body;
}
