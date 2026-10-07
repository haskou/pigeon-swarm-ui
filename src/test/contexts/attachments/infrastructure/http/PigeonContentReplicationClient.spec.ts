import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonContentReplicationClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonContentReplicationClient';
import vectors from '../../../../fixtures/content-replication-vectors.json';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

describe(PigeonContentReplicationClient.name, () => {
  async function fixture() {
    const device = await KeyPair.generate();
    const session = {
      deviceCredentialKeyPair: device,
      identity: {
        id: 'MCowBQYDK2VwAyEAowner0000000000000000000000000000000000000=',
      },
    } as unknown as Session;
    const http = { request: jest.fn().mockResolvedValue(undefined) };
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signature' }),
    };

    return {
      client: new PigeonContentReplicationClient(
        http,
        signer,
        publicMutationSignerAt(),
      ),
      http,
      session,
      signer,
    };
  }

  const networkId = '550e8400-e29b-41d4-a716-446655440001';
  const cid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';

  it('registers content with a signed mutation matching the published vector', async () => {
    const { client, http, session } = await fixture();
    const vector = vectors.vectors.find(({ name }) => name === 'register');

    await client.register(session, {
      cid,
      context: 'ipfs_private_upload',
      networkId,
      sizeBytes: 2048,
    });

    const [path, init] = http.request.mock.calls[0] as [
      string,
      { body: string; method: string },
    ];
    const body = JSON.parse(init.body);

    expect(path).toBe(`/ipfs/replication/${cid}`);
    expect(init.method).toBe('PUT');
    expect(body).toMatchObject({
      context: 'ipfs_private_upload',
      networkId,
      sizeBytes: 2048,
    });
    expect(body.mutation).toMatchObject({
      kind: 'put',
      recordId: vector?.proofBody.recordId,
      store: 'contentReplication',
    });
    expect(body.mutation.payloadDigest).toBe(
      publicMutationSignerAt().digestOfValue(vector?.payload),
    );
    expect(body.mutation.payloadDigest).toBe(vector?.proofBody.payloadDigest);
  });

  it('withdraws content with a signed tombstone matching the published vector', async () => {
    const { client, http, session } = await fixture();
    const vector = vectors.vectors.find(({ name }) => name === 'withdraw');

    await client.withdraw(session, cid, networkId);

    const [, init] = http.request.mock.calls[0] as [
      string,
      { body: string; method: string },
    ];
    const body = JSON.parse(init.body);

    expect(init.method).toBe('DELETE');
    expect(body.mutation).toMatchObject({
      kind: 'delete',
      store: 'contentReplication',
    });
    expect(body.mutation.payloadDigest).toBe(vector?.proofBody.payloadDigest);
  });
});
