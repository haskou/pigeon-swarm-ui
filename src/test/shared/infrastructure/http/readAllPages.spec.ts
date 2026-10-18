import { readAllPages } from '../../../../shared/infrastructure/http/readAllPages';

describe(readAllPages.name, () => {
  it('follows nextCursor until the node reports none', async () => {
    const responses: { nextCursor: string | null }[] = [
      { nextCursor: 'a' },
      { nextCursor: null },
    ];
    const fetchPage = (): Promise<{ nextCursor: string | null }> => {
      const response = responses.shift();

      if (response === undefined) {
        return Promise.reject(new Error('unexpected fetch'));
      }

      return Promise.resolve(response);
    };

    await expect(readAllPages(fetchPage)).resolves.toHaveLength(2);
  });

  it('refuses to read past 1000 pages', async () => {
    let calls = 0;
    const fetchPage = (): Promise<{ nextCursor: string | null }> => {
      calls += 1;

      return Promise.resolve({ nextCursor: `cursor-${calls}` });
    };

    await expect(readAllPages(fetchPage)).rejects.toThrow(
      'Node list exceeded 1000 pages',
    );
    expect(calls).toBe(1000);
  });
});
