export type Lang = "jp" | "kr";
export type Theme = "light" | "dark";
export type Preferences = { lang: Lang; theme: Theme };
export const defaultPreferences: Preferences = { lang: "jp", theme: "light" };
export function translate(lang: Lang, jp: string, kr: string) {
  return lang === "jp" ? jp : kr;
}
export const palette = {
  light: {
    bg: 0xf3f9ff,
    panel: 0xffffff,
    ink: 0x183453,
    muted: 0x6d88a5,
    line: 0xdbeafa,
    blue: 0x2878ee,
    sky: 0x51bcf4,
    press: 0xd8efff,
    red: 0xeb617a,
    green: 0x16a693,
  },
  dark: {
    bg: 0x0d192d,
    panel: 0x172a44,
    ink: 0xe6f3ff,
    muted: 0x8daac9,
    line: 0x29415f,
    blue: 0x69aaff,
    sky: 0x72d5fa,
    press: 0x244c78,
    red: 0xff8196,
    green: 0x55dbbd,
  },
};
