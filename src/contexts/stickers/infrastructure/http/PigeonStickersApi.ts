import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { PublicFileUpload } from '../../../attachments/application/contracts/PublicFileUpload';
import type { PigeonPublicFilesClient } from '../../../attachments/infrastructure/http/PigeonPublicFilesClient';
import type { MyStickersResource } from './resources/MyStickersResource';
import type { StickerInput } from './resources/StickerInput';
import type { StickerPackResource } from './resources/StickerPackResource';
import type { StickerResource } from './resources/StickerResource';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';
import { PublicImageUploadPreparer } from '../../../attachments/infrastructure/media/PublicImageUploadPreparer';

export class PigeonStickersApi {
  private readonly mutations = new PublicMutationSigner();

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly publicFiles: PigeonPublicFilesClient,
    private readonly publicImageUploadPreparer: Pick<
      PublicImageUploadPreparer,
      'prepare'
    >,
  ) {}

  private stickerCollectionPath(packId: string): string {
    return `/stickers/packs/${encodeURIComponent(packId)}/stickers`;
  }

  private stickerPath(packId: string, stickerId: string): string {
    return `${this.stickerCollectionPath(packId)}/${encodeURIComponent(
      stickerId,
    )}`;
  }

  private async submit<T>(
    session: Session,
    method: 'DELETE' | 'PATCH' | 'POST' | 'PUT',
    path: string,
    intent: {
      kind: 'delete' | 'put';
      payload: Record<string, unknown>;
      store: 'stickerPacks' | 'stickerUserLibraries';
    },
    fields: Record<string, unknown> = {},
  ): Promise<T> {
    let response: T | undefined;

    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          { ...intent, recordId: String(intent.payload.id) },
          position,
        ),
      async (mutation) => {
        const body = { ...fields, mutation };

        response = await this.http.request<T>(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, method, path, body),
          method,
        });
      },
    );

    return response as T;
  }

  private packRecord(
    pack: Pick<StickerPackResource, 'createdAt' | 'id' | 'name'> & {
      ownerIdentityId: string;
      stickers: StickerResource[];
    },
    updatedAt: number,
  ): Record<string, unknown> {
    return {
      createdAt: pack.createdAt,
      id: pack.id,
      name: pack.name,
      ownerIdentityId: pack.ownerIdentityId,
      scopeType: 'sticker_pack',
      stickers: pack.stickers.map((sticker) => ({
        assetCid: sticker.assetCid,
        contentType: sticker.contentType,
        dimensions: sticker.dimensions,
        id: sticker.id,
        sizeBytes: sticker.sizeBytes,
        type: sticker.type,
      })),
      updatedAt,
    };
  }

  private stickerFields(
    stickerId: string,
    input: StickerInput,
  ): StickerResource {
    return {
      assetCid: input.assetCid,
      contentType: input.contentType,
      dimensions: input.dimensions,
      id: stickerId,
      sizeBytes: input.sizeBytes,
      type: input.type,
    };
  }

  private libraryRecord(
    session: Session,
    kind: 'favorite' | 'recent' | 'saved',
    packId: string,
    stickerId?: string,
  ): Record<string, unknown> {
    const identityId = this.mutations.authorOf(session);
    const parts = [kind, identityId, packId, ...(stickerId ? [stickerId] : [])];

    return {
      id: parts.join(':'),
      identityId,
      packId,
      ...(stickerId ? { stickerId } : {}),
      scopeType: kind === 'saved' ? 'sticker_saved_pack' : `sticker_${kind}`,
    };
  }

  private async mutatePack(
    session: Session,
    change: {
      apply: (stickers: StickerResource[]) => StickerResource[];
      fields: Record<string, unknown>;
      method: 'DELETE' | 'PATCH' | 'POST';
      name?: string;
      packId: string;
      path: string;
      updatedAt: number;
    },
  ): Promise<StickerPackResource> {
    const { apply, fields, method, name, packId, path, updatedAt } = change;
    const current = await this.getPack(packId);
    const next = {
      ...current,
      name: name ?? current.name,
      stickers: apply(current.stickers),
    };

    return await this.submit<StickerPackResource>(
      session,
      method,
      path,
      {
        kind: 'put',
        payload: this.packRecord(next, updatedAt),
        store: 'stickerPacks',
      },
      { ...fields, updatedAt },
    );
  }

  private stickerOf(
    pack: StickerPackResource,
    stickerId: string,
  ): StickerResource {
    const sticker = pack.stickers.find(
      (candidate) => candidate.id === stickerId,
    );

    if (!sticker) throw new Error(`Sticker ${stickerId} missing from its pack`);

    return sticker;
  }

  public async loadAsset(assetCid: string, signal: AbortSignal): Promise<Blob> {
    return await this.http.requestBlob(
      `/ipfs/${encodeURIComponent(assetCid)}`,
      {
        signal,
      },
    );
  }

  public async uploadAsset(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    const preparedFile = await this.publicImageUploadPreparer.prepare(file);

    return await this.publicFiles.upload(
      session,
      await preparedFile.arrayBuffer(),
      preparedFile.name,
      preparedFile.type || 'application/octet-stream',
    );
  }

  public async listPacks(
    input: {
      ownerIdentityId?: string;
    } = {},
  ): Promise<StickerPackResource[]> {
    const query = new URLSearchParams();

    if (input.ownerIdentityId) {
      query.set('ownerIdentityId', input.ownerIdentityId);
    }

    const path = `/stickers/packs${query.size ? `?${query.toString()}` : ''}`;
    const response = await this.http.request<{
      results: StickerPackResource[];
    }>(path, {
      method: 'GET',
    });

    return response.results;
  }

  public async getPack(packId: string): Promise<StickerPackResource> {
    return await this.http.request<StickerPackResource>(
      `/stickers/packs/${encodeURIComponent(packId)}`,
      {
        method: 'GET',
      },
    );
  }

  public async getMyStickers(session: Session): Promise<MyStickersResource> {
    const path = '/stickers/me';

    return await this.http.request<MyStickersResource>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
  }

  public async createPack(
    session: Session,
    input: { createdAt: number; name: string; packId: string },
  ): Promise<StickerPackResource> {
    const path = '/stickers/packs';
    const saved = this.libraryRecord(session, 'saved', input.packId);
    const savedPackMutation = this.mutations.sign(
      session,
      {
        kind: 'put',
        payload: { ...saved, savedAt: input.createdAt },
        recordId: String(saved.id),
        store: 'stickerUserLibraries',
      },
      PublicMutationSigner.FIRST_POSITION,
    );

    return await this.submit<StickerPackResource>(
      session,
      'POST',
      path,
      {
        kind: 'put',
        payload: this.packRecord(
          {
            createdAt: input.createdAt,
            id: input.packId,
            name: input.name,
            ownerIdentityId: this.mutations.authorOf(session),
            stickers: [],
          },
          input.createdAt,
        ),
        store: 'stickerPacks',
      },
      {
        createdAt: input.createdAt,
        name: input.name,
        packId: input.packId,
        savedPackMutation,
      },
    );
  }

  public async updatePack(
    session: Session,
    packId: string,
    input: { name: string; updatedAt: number },
  ): Promise<StickerPackResource> {
    return await this.mutatePack(session, {
      apply: (stickers) => stickers,
      fields: { name: input.name },
      method: 'PATCH',
      name: input.name,
      packId,
      path: `/stickers/packs/${encodeURIComponent(packId)}`,
      updatedAt: input.updatedAt,
    });
  }

  public async addSticker(
    session: Session,
    packId: string,
    stickerId: string,
    input: StickerInput,
    updatedAt: number,
  ): Promise<StickerResource> {
    const pack = await this.mutatePack(session, {
      apply: (stickers) => [...stickers, this.stickerFields(stickerId, input)],
      fields: { ...input, stickerId },
      method: 'POST',
      packId,
      path: this.stickerCollectionPath(packId),
      updatedAt,
    });

    return this.stickerOf(pack, stickerId);
  }

  public async updateSticker(
    session: Session,
    packId: string,
    stickerId: string,
    input: StickerInput,
    updatedAt: number,
  ): Promise<StickerResource> {
    const pack = await this.mutatePack(session, {
      apply: (stickers) =>
        stickers.map((sticker) =>
          sticker.id === stickerId
            ? this.stickerFields(stickerId, input)
            : sticker,
        ),
      fields: input,
      method: 'PATCH',
      packId,
      path: this.stickerPath(packId, stickerId),
      updatedAt,
    });

    return this.stickerOf(pack, stickerId);
  }

  public async deleteSticker(
    session: Session,
    packId: string,
    stickerId: string,
    updatedAt: number,
  ): Promise<void> {
    await this.mutatePack(session, {
      apply: (stickers) =>
        stickers.filter((sticker) => sticker.id !== stickerId),
      fields: {},
      method: 'DELETE',
      packId,
      path: this.stickerPath(packId, stickerId),
      updatedAt,
    });
  }

  public async savePack(
    session: Session,
    packId: string,
    savedAt: number,
  ): Promise<void> {
    await this.submit(
      session,
      'PUT',
      `/stickers/packs/${encodeURIComponent(packId)}/saved`,
      {
        kind: 'put',
        payload: {
          ...this.libraryRecord(session, 'saved', packId),
          savedAt,
        },
        store: 'stickerUserLibraries',
      },
      { savedAt },
    );
  }

  public async unsavePack(session: Session, packId: string): Promise<void> {
    await this.submit(
      session,
      'DELETE',
      `/stickers/packs/${encodeURIComponent(packId)}/saved`,
      {
        kind: 'delete',
        payload: {
          ...this.libraryRecord(session, 'saved', packId),
          removed: true,
        },
        store: 'stickerUserLibraries',
      },
    );
  }

  public async favoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
    favoritedAt: number,
  ): Promise<void> {
    await this.submit(
      session,
      'PUT',
      `${this.stickerPath(packId, stickerId)}/favorite`,
      {
        kind: 'put',
        payload: {
          ...this.libraryRecord(session, 'favorite', packId, stickerId),
          favoritedAt,
        },
        store: 'stickerUserLibraries',
      },
      { favoritedAt },
    );
  }

  public async unfavoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    await this.submit(
      session,
      'DELETE',
      `${this.stickerPath(packId, stickerId)}/favorite`,
      {
        kind: 'delete',
        payload: {
          ...this.libraryRecord(session, 'favorite', packId, stickerId),
          removed: true,
        },
        store: 'stickerUserLibraries',
      },
    );
  }

  public async markStickerUsed(
    session: Session,
    packId: string,
    stickerId: string,
    usedAt: number,
  ): Promise<void> {
    await this.submit(
      session,
      'POST',
      `${this.stickerPath(packId, stickerId)}/used`,
      {
        kind: 'put',
        payload: {
          ...this.libraryRecord(session, 'recent', packId, stickerId),
          usedAt,
        },
        store: 'stickerUserLibraries',
      },
      { usedAt },
    );
  }
}
