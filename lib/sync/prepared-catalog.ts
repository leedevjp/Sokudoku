import type { Bootstrap } from "../game/data/bootstrap";

export type PreparedCatalog = Pick<Bootstrap, "user_id" | "words" | "readingWords"> & { catalogKey: string };

/** Hydrate only a matching worker reply; account, scope and version are in the token. */
export function restorePreparedCatalog(reply: Bootstrap, cached?: PreparedCatalog): Bootstrap {
  if (!reply.catalogUnchanged) return reply;
  if (!cached || cached.user_id !== reply.user_id || cached.catalogKey !== reply.catalogKey)
    throw Error("CATALOG_CACHE_MISS");
  const { catalogUnchanged: ignored, ...fresh } = reply;
  void ignored;
  return { ...fresh, words: cached.words, readingWords: cached.readingWords };
}
