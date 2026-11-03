export type Lang = "jp" | "kr";
export type Theme = "light" | "dark";
export type Preferences = { lang: Lang; theme: Theme };
export const defaultPreferences: Preferences = { lang: "jp", theme: "light" };
export function translate(lang: Lang, jp: string, kr: string) {
  return lang === "jp" ? jp : kr;
}
// Shared design tokens from the supplied light/dark reference.
export const palette = {
  light: {
    bg: 0xf3f8ff,
    panel: 0xffffff,
    tint: 0xf1f6ff,
    disabledBg: 0xe5e7eb,
    disabledInk: 0x6b7280,
    ink: 0x14264a,
    muted: 0x5b6b87,
    line: 0xd3e1f5,
    shade: 0xb7cae8,
    blue: 0x2b7bf0,
    blueDark: 0x1b5fc4,
    sky: 0x6fb4ff,
    press: 0xe4eeff,
    red: 0xf0506e,
    green: 0x17b26a,
    dot: 0x2b7bf0,
    onBrand: 0xffffff,
  },
  dark: {
    bg: 0x0b1530,
    panel: 0x15244a,
    tint: 0x1a2c58,
    disabledBg: 0x374151,
    disabledInk: 0x9ca3af,
    ink: 0xeaf1ff,
    muted: 0x93a7cc,
    line: 0x27396b,
    shade: 0x08102a,
    blue: 0x4a93ff,
    blueDark: 0x2a6bd6,
    sky: 0x6fb4ff,
    press: 0x1b3266,
    red: 0xff5c7c,
    green: 0x2fd28a,
    dot: 0x82a5ff,
    onBrand: 0x06152f,
  },
};
