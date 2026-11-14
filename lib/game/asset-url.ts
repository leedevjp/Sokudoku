const urls: Record<string, string> = JSON.parse(process.env.NEXT_PUBLIC_GAME_ASSETS ?? "{}");

export const gameAssetUrl = (source: string) => urls[source] ?? source;
export const gameAssetUrls = () => Object.values(urls);
