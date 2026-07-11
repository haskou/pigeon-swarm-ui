import type {
  MyStickersResource,
  Session,
  StickerPackResource,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { stickerAssetUrl } from './stickerPressPreview';

const STICKER_CACHE_TTL_MS = 30_000;
const STICKER_PRELOAD_LIMIT = 24;
const STICKER_PRELOAD_BATCH_SIZE = 4;
const STICKER_PRELOAD_IDLE_TIMEOUT_MS = 750;

type StickerCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

let stickerPacksCache: StickerCacheEntry<StickerPackResource[]> | null = null;
const myStickersCache = new Map<
  string,
  StickerCacheEntry<MyStickersResource>
>();
const stickerPackCache = new Map<
  string,
  StickerCacheEntry<StickerPackResource>
>();
const preloadedStickerAssetCids = new Set<string>();
const pendingStickerAssetCids = new Set<string>();
let preloadHandle: number | ReturnType<typeof setTimeout> | null = null;

export async function cachedListStickerPacks(): Promise<StickerPackResource[]> {
  const now = Date.now();

  if (stickerPacksCache && stickerPacksCache.expiresAt > now) {
    return stickerPacksCache.value;
  }

  const packs = await applicationContainer.stickers.list();
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

  const library = await applicationContainer.stickers.getMyStickers(session);
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

  const pack = await applicationContainer.stickers.getPack(packId);
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

export function preloadStickerAssets(
  assetCids: string[],
  limit = STICKER_PRELOAD_LIMIT,
): void {
  assetCids.slice(0, limit).forEach(preloadStickerAsset);
}

export function preloadStickerAsset(assetCid: string): void {
  if (
    preloadedStickerAssetCids.has(assetCid) ||
    pendingStickerAssetCids.has(assetCid)
  ) {
    return;
  }

  pendingStickerAssetCids.add(assetCid);
  scheduleStickerAssetPreload();
}

function scheduleStickerAssetPreload(): void {
  if (preloadHandle !== null || pendingStickerAssetCids.size === 0) return;

  const run = () => {
    preloadHandle = null;

    Array.from(pendingStickerAssetCids)
      .slice(0, STICKER_PRELOAD_BATCH_SIZE)
      .forEach(loadStickerAsset);

    scheduleStickerAssetPreload();
  };

  if ('requestIdleCallback' in window) {
    preloadHandle = window.requestIdleCallback(run, {
      timeout: STICKER_PRELOAD_IDLE_TIMEOUT_MS,
    });

    return;
  }

  preloadHandle = globalThis.setTimeout(run, STICKER_PRELOAD_IDLE_TIMEOUT_MS);
}

function loadStickerAsset(assetCid: string): void {
  pendingStickerAssetCids.delete(assetCid);
  preloadedStickerAssetCids.add(assetCid);
  const image = new Image();
  image.decoding = 'async';
  image.src = stickerAssetUrl(assetCid);
}
