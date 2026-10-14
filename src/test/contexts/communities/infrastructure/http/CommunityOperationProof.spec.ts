import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { CommunityOperationContent } from '../../../../../contexts/communities/infrastructure/http/CommunityOperationContent';
import type { CommunityOperationDocument } from '../../../../../contexts/communities/infrastructure/http/CommunityOperationDocument';

import { CommunityOperationProof } from '../../../../../contexts/communities/infrastructure/http/CommunityOperationProof';
import vectors from '../../../../fixtures/community-operation-vectors.json';
import { MlsTestIdentity } from '../mls/MlsTestIdentity';
import { CommunityOperationHistory } from './CommunityOperationHistory';

describe(CommunityOperationProof.name, () => {
  let cast: Record<string, MlsTestIdentity>;
  let history: CommunityOperationHistory;
  let joined: CommunityOperationDocument;
  /** `document` re-addressed to its changed content, keeping its signature. */
  const altered = (
    document: CommunityOperationDocument,
    change: Partial<CommunityOperationContent>,
  ): CommunityOperationDocument => ({
    ...CommunityOperationProof.seal(
      { ...CommunityOperationProof.contentOf(document), ...change },
      cast.bob.keyPair,
    ),
    identitySignature: document.identitySignature,
  });
  const open = (document: unknown) =>
    CommunityOperationProof.open(document, history.communityId);

  beforeAll(async () => {
    cast = await MlsTestIdentity.cast(['alice', 'bob']);
    history = new CommunityOperationHistory(cast.alice);
    history.add(cast.alice, cast.bob);
    [, joined] = history.documents;
  });

  it.each(vectors.cases)(
    'opens the node vector $name to its author and parents',
    ({ derived }) => {
      const operation = CommunityOperationProof.open(
        derived.payload,
        derived.payload.communityId,
      );

      expect(operation?.getHash()).toBe(derived.digest);
      expect(operation?.getAuthorIdentityId()).toBe(
        derived.payload.authorIdentityId,
      );
      expect(operation?.getParents()).toEqual(derived.payload.parents);
    },
  );

  it('opens what the author sealed', () => {
    const operation = open(joined);

    expect(operation?.getAction()).toBe('member_joined');
    expect(operation?.getArguments()).toEqual({
      identityId: cast.bob.id,
      method: 'added',
    });
    expect(operation?.getAuthorIdentityId()).toBe(cast.alice.id);
    expect(operation?.getHash()).toBe(
      CommunityOperationHistory.digestOf(joined),
    );
  });

  it('rejects an operation another key signed in the author name', () => {
    expect(
      open(history.append(cast.alice, 'member_left', {}, cast.bob.keyPair)),
    ).toBeUndefined();
  });

  it('rejects altered arguments, even re-addressed', () => {
    expect(
      open({ ...joined, args: { identityId: cast.alice.id, method: 'added' } }),
    ).toBeUndefined();
    expect(
      open(altered(joined, { args: { identityId: cast.alice.id } })),
    ).toBeUndefined();
  });

  it('rejects an operation reattributed to another author', () => {
    expect(
      open(altered(joined, { authorIdentityId: cast.bob.id })),
    ).toBeUndefined();
  });

  it('rejects an operation of another community', () => {
    expect(
      CommunityOperationProof.open(joined, 'another-community'),
    ).toBeUndefined();
  });

  it('rejects a document with a field the author did not sign', () => {
    expect(open({ ...joined, ownerIdentityId: cast.bob.id })).toBeUndefined();
  });

  it('rejects malformed documents without throwing', () => {
    expect(open(undefined)).toBeUndefined();
    expect(open('operation')).toBeUndefined();
    expect(open({ ...joined, createdAt: -1 })).toBeUndefined();
    expect(open({ ...joined, args: [] })).toBeUndefined();
    expect(
      open({ ...joined, identitySignature: 'not-a-signature' }),
    ).toBeUndefined();
  });

  it('rejects parents that are unsorted, malformed or missing', () => {
    const [first, second] = ['B', 'A'].map((letter) => letter.repeat(43));
    const content = CommunityOperationProof.contentOf(joined);
    const sealedWith = (parents: string[]) =>
      CommunityOperationProof.seal({ ...content, parents }, cast.alice.keyPair);

    expect(open(sealedWith([second, first]))).toBeDefined();
    expect(open(sealedWith([first, second]))).toBeUndefined();
    expect(open(sealedWith(['short']))).toBeUndefined();
    expect(open(sealedWith([]))).toBeUndefined();
  });

  it('rejects a genesis with parents or for an id its owner did not derive', () => {
    const [genesis] = history.documents;
    const content = CommunityOperationProof.contentOf(genesis);

    expect(
      open(
        CommunityOperationProof.seal(
          { ...content, parents: ['A'.repeat(43)] },
          cast.alice.keyPair,
        ),
      ),
    ).toBeUndefined();
    expect(
      open(
        CommunityOperationProof.seal(
          { ...content, args: { ...content.args, nonce: 'another-nonce' } },
          cast.alice.keyPair,
        ),
      ),
    ).toBeUndefined();
    expect(open(genesis)?.isGenesis()).toBe(true);
  });

  it('signs with the identity key it is given', async () => {
    const sealed = CommunityOperationProof.seal(
      CommunityOperationProof.contentOf(joined),
      await KeyPair.generate(),
    );

    expect(sealed.id).toBe(joined.id);
    expect(open(sealed)).toBeUndefined();
  });
});
