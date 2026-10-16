import type { KeyPair, Signature } from '@haskou/pigeon-swarm-crypto';

import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { NodeBlockListSigner } from '../../../../../contexts/nodeAccess/infrastructure/signing/NodeBlockListSigner';

describe('NodeBlockListSigner', () => {
  it('signs the domain-tagged RFC 8785 JSON the node verifies', async () => {
    const keyPair = mock<KeyPair>();
    keyPair.sign.mockReturnValue(
      mock<Signature>({ valueOf: () => 'owner-signature' }),
    );

    const signed = await new NodeBlockListSigner().sign(
      {
        blockedIdentityIds: ['identity-b', 'identity-a'],
        blockedNodePeerIds: ['peer-1'],
        issuedAt: 1700000000000,
        ownerIdentityId: 'owner-1',
        version: 3,
      },
      mock<Session>({ keyPair }),
    );

    expect(keyPair.sign).toHaveBeenCalledWith(
      'pigeon:node-block-list:v1\n' +
        '{"blockedIdentityIds":["identity-b","identity-a"],' +
        '"blockedNodePeerIds":["peer-1"],"issuedAt":1700000000000,' +
        '"ownerIdentityId":"owner-1","type":"pigeon-node-block-list",' +
        '"version":3}',
    );
    expect(signed.identitySignature).toBe('owner-signature');
  });
});
