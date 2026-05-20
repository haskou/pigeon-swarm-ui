import type {
  MyStickersResource,
  Session,
  StickerPackResource,
} from '../../../../shared/domain/pigeonResources.types';

import { pigeonApplication } from '../../../../app/composition/applicationContainer';
import { stickerAssetUrl } from './stickerPressPreview';

const STICKER_CACHE_TTL_MS = 30_000;

type StickerCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

let stickerPacksCache: StickerCacheEntry<StickerPackResource[]> | null = null;
const myStickersCache = new Map<string, StickerCacheEntry<MyStickersResource>>();
const stickerPackCache = new Map<string, StickerCacheEntry<StickerPackResource>>();
const preloadedStickerAssetCids = new Set<string>();

export async function cachedListStickerPacks(): Promise<StickerPackResource[]> {
  const now = Date.now();
  if (stickerPacksCache && stickerPacksCache.expiresAt > now) {
    return stickerPacksCache.value;
  }

  const packs = await pigeonApplication.listStickerPacks();
  stickerPacksCache = {
    expiresAt: now + STICKER_CACHE_TTL_MS,
    value: packs,
  };

  return packs;
}

export async function cachedGetMyStickers(
  session: Session,
): Promise<MyStickersResource> {
  const now = Date.now();
  const cached = myStickersCache.get(session.identity.id);
  if (cached && cached.expiresAt > now) return cached.value;

  const library = await pigeonApplication.getMyStickers(session);
  myStickersCache.set(session.identity.id, {
    expiresAt: now + STICKER_CACHE_TTL_MS,
    value: library,
  });

  return library;
}

export async function cachedGetStickerPack(
  packId: string,
): Promise<StickerPackResource> {
  const now = Date.now();
  const cached = stickerPackCache.get(packId);
  if (cached && cached.expiresAt > now) return cached.value;

  const pack = await pigeonApplication.getStickerPack(packId);
  stickerPackCache.set(packId, {
    expiresAt: now + STICKER_CACHE_TTL_MS,
    value: pack,
  });

  return pack;
}

export function invalidateStickerCaches(): void {
  stickerPacksCache = null;
  myStickersCache.clear();
  stickerPackCache.clear();
}

export function preloadStickerAsset(assetCid: string): void {
  if (preloadedStickerAssetCids.has(assetCid)) return;

  preloadedStickerAssetCids.add(assetCid);
  const image = new Image();
  image.src = stickerAssetUrl(assetCid);
}
