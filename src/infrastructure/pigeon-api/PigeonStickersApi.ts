import type {
  PublicFileUpload,
  Session,
  StickerInput,
  StickerPackInput,
  StickerPackResource,
  StickerResource,
} from '../../domain/types';
import type { HttpJsonClient } from '../http/HttpJsonClient';
import type { RequestSigner } from './RequestSigner';

import { PigeonPublicFilesClient } from './PigeonPublicFilesClient';

export class PigeonStickersApi {
  private readonly publicFiles: PigeonPublicFilesClient;

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    publicFiles?: PigeonPublicFilesClient,
  ) {
    this.publicFiles = publicFiles ?? new PigeonPublicFilesClient(http, signer);
  }

  public async uploadAsset(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    return await this.publicFiles.upload(
      session,
      await file.arrayBuffer(),
      file.name,
      file.type || 'application/octet-stream',
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

  private stickerCollectionPath(packId: string): string {
    return `/stickers/packs/${encodeURIComponent(packId)}/stickers`;
  }

  private stickerPath(packId: string, stickerId: string): string {
    return `${this.stickerCollectionPath(packId)}/${encodeURIComponent(
      stickerId,
    )}`;
  }
}
