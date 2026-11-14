export const battleImages = [
  ["battle-meadow-original-v4", "/battle/meadow-original-v4.webp"],
  ["battle-mage-v5", "/battle/mage-v5.webp"],
  ["battle-mage-idle-v1", "/battle/mage-idle-v1.webp"],
  ["battle-mage-locomotion-v1", "/battle/mage-locomotion-v1.webp"],
  ["battle-mandrakes-v5", "/battle/mandrakes-v5.webp"],
  ["battle-magic-v5", "/battle/magic-v5.webp"],
  ["battle-combo-burst-v1", "/battle/combo-burst-v1.webp"],
  ["battle-emotion-v1", "/battle/emotion-v1.webp"],
] as const;
export const laterImages = [
  ["battle-forest-v1", "/battle/forest-v1.webp"],
  ["battle-moon-ruins-v1", "/battle/moon-ruins-v1.webp"],
] as const;
export const effectFiles = ["dash", "hybrid", "jelly", "hybrid-combo", "miss-combo"] as const;
export const battleReady = (has: (key: string) => boolean) => battleImages.every(([key]) => has(key));
