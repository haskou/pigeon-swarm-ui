import { visibleImageAlbumItems } from './visibleImageAlbumItems';

describe(visibleImageAlbumItems.name, () => {
  it('keeps the rendered album capped while previews can still track every image', () => {
    const items = Array.from({ length: 6 }, (_, index) => index);

    expect(visibleImageAlbumItems(items)).toEqual(items.slice(0, 4));
    expect(Array(items.length).fill(null)).toHaveLength(6);
  });

  it('shows every item when the album does not overflow', () => {
    const items = Array.from({ length: 3 }, (_, index) => index);

    expect(visibleImageAlbumItems(items)).toEqual(items);
  });
});
