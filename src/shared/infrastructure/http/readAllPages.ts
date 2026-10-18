const MAX_PAGES = 1000;

/**
 * Fetches every page of a cursor-paged node list, following `nextCursor` until
 * the node reports none. Stops when the node repeats a cursor, so a faulty
 * node cannot loop the client. Refuses to read past MAX_PAGES pages.
 */
export async function readAllPages<Page extends { nextCursor: string | null }>(
  fetchPage: (cursor: string | undefined) => Promise<Page>,
): Promise<Page[]> {
  const pages: Page[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;

  for (;;) {
    if (pages.length >= MAX_PAGES) {
      throw new Error(`Node list exceeded ${MAX_PAGES} pages`);
    }

    const page = await fetchPage(cursor);

    pages.push(page);

    const next = page.nextCursor;

    if (typeof next !== 'string' || seen.has(next)) return pages;

    seen.add(next);
    cursor = next;
  }
}
