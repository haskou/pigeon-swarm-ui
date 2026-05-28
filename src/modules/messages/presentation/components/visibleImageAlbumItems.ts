export function visibleImageAlbumItems<T>(items: T[]): T[] {
  return items.length > 4 ? items.slice(0, 4) : items;
}
