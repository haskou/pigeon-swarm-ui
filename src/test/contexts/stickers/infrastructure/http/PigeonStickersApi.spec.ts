import { KeyPair, SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';
import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonPublicFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPublicFilesClient';
import { PigeonStickersApi } from '../../../../../contexts/stickers/infrastructure/http/PigeonStickersApi';
import { canonicalJson } from '../../../../../shared/infrastructure/crypto/canonicalJson';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

describe(PigeonStickersApi.name, () => {
  it('loads sticker bytes through the protected blob client', async () => {
    const http = mock<HttpJsonClient>();
    const blob = new Blob(['image'], { type: 'image/png' });
    const controller = new AbortController();
    http.requestBlob.mockResolvedValue(blob);
    const api = new PigeonStickersApi(
      http,
      mock<RequestSigner>(),
      publicMutationSignerAt(),
      mock<PigeonPublicFilesClient>(),
      { prepare: jest.fn() },
    );

    await expect(api.loadAsset('cid/value', controller.signal)).resolves.toBe(
      blob,
    );
    expect(http.requestBlob).toHaveBeenCalledWith('/ipfs/cid%2Fvalue', {
      signal: controller.signal,
    });
  });

  it('converts sticker images before uploading the public asset', async () => {
    const session = { identity: { id: 'identity-1' } } as Session;
    const sourceFile = new File(['png'], 'smile.png', { type: 'image/png' });
    const webpFile = new File(['webp'], 'smile.webp', { type: 'image/webp' });
    const publicFiles = {
      upload: jest.fn().mockResolvedValue({
        cid: 'sticker-cid',
        contentType: 'image/webp',
        filename: 'smile.webp',
        size: webpFile.size,
      }),
    } as unknown as PigeonPublicFilesClient;
    const publicImageUploadPreparer = {
      prepare: jest.fn().mockResolvedValue(webpFile),
    };
    const api = new PigeonStickersApi(
      {} as HttpJsonClient,
      {} as RequestSigner,
      publicMutationSignerAt(),
      publicFiles,
      publicImageUploadPreparer,
    );

    await expect(api.uploadAsset(session, sourceFile)).resolves.toEqual({
      cid: 'sticker-cid',
      contentType: 'image/webp',
      filename: 'smile.webp',
      size: webpFile.size,
    });

    expect(publicImageUploadPreparer.prepare).toHaveBeenCalledWith(sourceFile);
    expect(publicFiles.upload).toHaveBeenCalledWith(
      session,
      expect.any(ArrayBuffer),
      'smile.webp',
      'image/webp',
    );
  });

  describe('signed mutations', () => {
    const digestOf = (record: Record<string, unknown>): string =>
      Buffer.from(SHA256Hash.from(canonicalJson(record)).toString(), 'hex')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    const input = {
      assetCid: 'cid-new',
      contentType: 'image/webp',
      dimensions: { height: 64, width: 64 },
      sizeBytes: 10,
      type: 'static' as const,
    };
    const existing = {
      assetCid: 'cid-old',
      contentType: 'image/webp',
      dimensions: { height: 32, width: 32 },
      id: 'sticker-1',
      sizeBytes: 5,
      type: 'static' as const,
    };
    const pack = {
      createdAt: 100,
      id: 'pack-1',
      name: 'Pack',
      ownerIdentityId: 'identity-1',
      stickers: [existing],
      updatedAt: 100,
    };

    async function setup() {
      const request = jest.fn((path: string, init: { method: string }) =>
        Promise.resolve(
          init.method === 'GET'
            ? pack
            : { ...pack, stickers: [existing, { ...input, id: 'sticker-2' }] },
        ),
      );
      const session = {
        deviceCredentialKeyPair: await KeyPair.generate(),
        identity: { id: 'identity-1' },
      } as unknown as Session;
      const api = new PigeonStickersApi(
        { request } as unknown as HttpJsonClient,
        {
          headers: jest.fn().mockResolvedValue({ signature: 's' }),
        } as unknown as RequestSigner,
        publicMutationSignerAt(),
        mock<PigeonPublicFilesClient>(),
        { prepare: jest.fn() },
      );
      const last = () => {
        const [path, init] = request.mock.calls[
          request.mock.calls.length - 1
        ] as unknown as [string, { body: string; method: string }];

        return {
          body: JSON.parse(init.body) as Record<
            string,
            Record<string, unknown>
          >,
          method: init.method,
          path,
        };
      };

      return { api, last, session };
    }

    it('signs pack creation with its saved-pack record', async () => {
      const { api, last, session } = await setup();

      await api.createPack(session, {
        createdAt: 100,
        name: 'Pack',
        packId: 'pack-1',
      });

      const { body, path } = last();

      expect(path).toBe('/stickers/packs');
      expect(body).toMatchObject({ createdAt: 100, packId: 'pack-1' });
      expect(body.mutation).toMatchObject({
        kind: 'put',
        payloadDigest: digestOf({
          createdAt: 100,
          id: 'pack-1',
          name: 'Pack',
          ownerIdentityId: 'identity-1',
          scopeType: 'sticker_pack',
          stickers: [],
          updatedAt: 100,
        }),
        predecessor: null,
        recordId: 'pack-1',
        sequence: 0,
        store: 'stickerPacks',
      });
      expect(body.savedPackMutation).toMatchObject({
        payloadDigest: digestOf({
          id: 'saved:identity-1:pack-1',
          identityId: 'identity-1',
          packId: 'pack-1',
          savedAt: 100,
          scopeType: 'sticker_saved_pack',
        }),
        recordId: 'saved:identity-1:pack-1',
        store: 'stickerUserLibraries',
      });
    });

    it('signs the exact pack document resulting from sticker changes', async () => {
      const { api, last, session } = await setup();
      const doc = (stickers: unknown[], updatedAt: number, name = 'Pack') =>
        digestOf({
          createdAt: 100,
          id: 'pack-1',
          name,
          ownerIdentityId: 'identity-1',
          scopeType: 'sticker_pack',
          stickers,
          updatedAt,
        });
      const added = { ...input, id: 'sticker-2' };

      await api.addSticker(session, 'pack-1', 'sticker-2', input, 200);
      expect(last().body).toMatchObject({
        stickerId: 'sticker-2',
        updatedAt: 200,
      });
      expect(last().body.mutation.payloadDigest).toBe(
        doc([existing, added], 200),
      );

      await api.updateSticker(session, 'pack-1', 'sticker-1', input, 300);
      expect(last().method).toBe('PATCH');
      expect(last().body.mutation.payloadDigest).toBe(
        doc([{ ...input, id: 'sticker-1' }], 300),
      );

      await api.deleteSticker(session, 'pack-1', 'sticker-1', 400);
      expect(last().method).toBe('DELETE');
      expect(last().body).toMatchObject({ updatedAt: 400 });
      expect(last().body.mutation.payloadDigest).toBe(doc([], 400));

      await api.updatePack(session, 'pack-1', { name: 'New', updatedAt: 500 });
      expect(last().body.mutation.payloadDigest).toBe(
        doc([existing], 500, 'New'),
      );
    });

    it('signs library favorites, saved packs and recents', async () => {
      const { api, last, session } = await setup();

      await api.favoriteSticker(session, 'pack-1', 'sticker-1', 10);
      expect(last().path).toBe(
        '/stickers/packs/pack-1/stickers/sticker-1/favorite',
      );
      expect(last().body).toMatchObject({ favoritedAt: 10 });
      expect(last().body.mutation).toMatchObject({
        kind: 'put',
        recordId: 'favorite:identity-1:pack-1:sticker-1',
        store: 'stickerUserLibraries',
      });

      await api.unfavoriteSticker(session, 'pack-1', 'sticker-1');
      expect(last().method).toBe('DELETE');
      expect(last().body.mutation).toMatchObject({
        kind: 'delete',
        payloadDigest: digestOf({
          id: 'favorite:identity-1:pack-1:sticker-1',
          identityId: 'identity-1',
          packId: 'pack-1',
          removed: true,
          scopeType: 'sticker_favorite',
          stickerId: 'sticker-1',
        }),
      });

      await api.markStickerUsed(session, 'pack-1', 'sticker-1', 20);
      expect(last().body).toMatchObject({ usedAt: 20 });
      expect(last().body.mutation.recordId).toBe(
        'recent:identity-1:pack-1:sticker-1',
      );

      await api.savePack(session, 'pack-1', 30);
      expect(last().body).toMatchObject({ savedAt: 30 });

      await api.unsavePack(session, 'pack-1');
      expect(last().body.mutation).toMatchObject({
        kind: 'delete',
        recordId: 'saved:identity-1:pack-1',
      });
    });
  });
});
