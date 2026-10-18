/** The page size the client asks for: the node's maximum. */
const PAGE_LIMIT = 100;

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

/**
 * `path` with the page query for one array of a node response that pages
 * several arrays on its own: `<name>Limit` and `<name>Cursor`.
 */
export function prefixedPagedPath(
  path: string,
  name: string,
  cursor: string | undefined,
): string {
  const query = new URLSearchParams();

  query.set(`${name}Limit`, String(PAGE_LIMIT));

  if (cursor !== undefined) query.set(`${name}Cursor`, cursor);

  return `${path}?${query.toString()}`;
}
