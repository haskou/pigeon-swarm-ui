import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { PublicFileUpload } from '../../../attachments/application/contracts/PublicFileUpload';
import type { PigeonPublicFilesClient } from '../../../attachments/infrastructure/http/PigeonPublicFilesClient';
import type { MyStickersResource } from './resources/MyStickersResource';
import type { StickerInput } from './resources/StickerInput';
import type { StickerPackInput } from './resources/StickerPackInput';
import type { StickerPackResource } from './resources/StickerPackResource';
import type { StickerResource } from './resources/StickerResource';

import { PublicImageUploadPreparer } from '../../../attachments/infrastructure/media/PublicImageUploadPreparer';

export class PigeonStickersApi {
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
    input: StickerPackInput,
  ): Promise<StickerPackResource> {
    const path = '/stickers/packs';

    return await this.http.request<StickerPackResource>(path, {
      body: JSON.stringify(input),
      headers: await this.signer.headers(session, 'POST', path, input),
      method: 'POST',
    });
  }

  public async updatePack(
    session: Session,
    packId: string,
    input: Partial<StickerPackInput>,
  ): Promise<StickerPackResource> {
    const path = `/stickers/packs/${encodeURIComponent(packId)}`;

    return await this.http.request<StickerPackResource>(path, {
      body: JSON.stringify(input),
      headers: await this.signer.headers(session, 'PATCH', path, input),
      method: 'PATCH',
    });
  }

  public async addSticker(
    session: Session,
    packId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    const path = this.stickerCollectionPath(packId);

    return await this.http.request<StickerResource>(path, {
      body: JSON.stringify(input),
      headers: await this.signer.headers(session, 'POST', path, input),
      method: 'POST',
    });
  }

  public async updateSticker(
    session: Session,
    packId: string,
    stickerId: string,
    input: StickerInput,
  ): Promise<StickerResource> {
    const path = this.stickerPath(packId, stickerId);

    return await this.http.request<StickerResource>(path, {
      body: JSON.stringify(input),
      headers: await this.signer.headers(session, 'PATCH', path, input),
      method: 'PATCH',
    });
  }

  public async deleteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    const path = this.stickerPath(packId, stickerId);

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
  }

  public async savePack(session: Session, packId: string): Promise<void> {
    const path = `/stickers/packs/${encodeURIComponent(packId)}/saved`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'PUT', path),
      method: 'PUT',
    });
  }

  public async unsavePack(session: Session, packId: string): Promise<void> {
    const path = `/stickers/packs/${encodeURIComponent(packId)}/saved`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
  }

  public async favoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    const path = `${this.stickerPath(packId, stickerId)}/favorite`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'PUT', path),
      method: 'PUT',
    });
  }

  public async unfavoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    const path = `${this.stickerPath(packId, stickerId)}/favorite`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
  }

  public async markStickerUsed(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void> {
    const path = `${this.stickerPath(packId, stickerId)}/used`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'POST', path),
      method: 'POST',
    });
  }
}
