/** The page size the client asks for: the node's maximum. */
export const PAGE_LIMIT = 100;

/**
 * `path` with its page query. The signer signs only the path before `?`, so
 * the same string serves for both the signature and the request.
 */
export function pagedPath(
  path: string,
  cursor: string | undefined,
  filters = new URLSearchParams(),
): string {
  const query = new URLSearchParams(filters);

  query.set('limit', String(PAGE_LIMIT));

  if (cursor !== undefined) query.set('cursor', cursor);

  return `${path}?${query.toString()}`;
}
