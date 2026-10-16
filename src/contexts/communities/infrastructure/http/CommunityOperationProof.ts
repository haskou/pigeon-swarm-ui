import {
  CanonicalJson,
  CommitmentId,
  CommunityOperationSignature,
  type KeyPair,
  PrivateKey,
  SHA256Hash,
  Signature,
} from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import type { CommunityOperationContent } from './CommunityOperationContent';
import type { CommunityOperationDocument } from './CommunityOperationDocument';

import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { CommunityOperation } from '../../domain/operations/CommunityOperation';

const SCOPE_TYPE = 'community_operation';
const DIGEST = /^[A-Za-z0-9_-]{43}$/;
const MAX_PARENTS = 64;
const FIELDS = [
  'action',
  'args',
  'authorIdentityId',
  'communityId',
  'createdAt',
  'id',
  'identitySignature',
  'networkId',
  'parents',
  'scopeType',
];
const TEXT_FIELDS = [
  'action',
  'authorIdentityId',
  'communityId',
  'id',
  'identitySignature',
  'networkId',
];

/**
 * The one owner of a community operation's content address and of its
 * author's identity signature. The id commits to the content; the author's
 * identity key, not a device the node vouches for, signs the id. So a member
 * opens an operation only when its author really made it, and no node can
 * forge, alter or reattribute one.
 */
export class CommunityOperationProof {
  /** base64url sha256 of the canonical content. */
  private static digestOf(content: CommunityOperationContent): string {
    return encodeBase64Url(
      Buffer.from(
        SHA256Hash.from(CanonicalJson.serialize(content)).toString(),
        'hex',
      ),
    );
  }

  /** The digest of `content`, or `undefined` when it is not canonical JSON. */
  private static safeDigestOf(
    content: CommunityOperationContent,
  ): string | undefined {
    try {
      return CommunityOperationProof.digestOf(content);
    } catch {
      return undefined;
    }
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /** At most 64 well-formed digests, strictly ascending. */
  private static areParents(value: unknown): boolean {
    return (
      Array.isArray(value) &&
      value.length <= MAX_PARENTS &&
      value.every(
        (parent, index) =>
          typeof parent === 'string' &&
          DIGEST.test(parent) &&
          (index === 0 || (value[index - 1] as string) < parent),
      )
    );
  }

  /** Whether `value` has the shape of a stored operation, and only that. */
  private static isDocument(
    value: unknown,
  ): value is CommunityOperationDocument {
    if (!CommunityOperationProof.isRecord(value)) return false;

    return (
      Object.keys(value).sort().join() === FIELDS.join() &&
      TEXT_FIELDS.every((field) => typeof value[field] === 'string') &&
      value.scopeType === SCOPE_TYPE &&
      Number.isSafeInteger(value.createdAt) &&
      (value.createdAt as number) >= 0 &&
      CommunityOperationProof.isRecord(value.args) &&
      CommunityOperationProof.areParents(value.parents)
    );
  }

  /** Whether the author's identity key signed this operation id. */
  private static isSignedByAuthor(
    document: CommunityOperationDocument,
  ): boolean {
    try {
      CommunityOperationSignature.verify(
        document.id,
        new Signature(document.identitySignature),
        IdentityId.fromString(document.authorIdentityId).getPublicKey(),
      );

      return true;
    } catch {
      return false;
    }
  }

  /** Whether a genesis creates the community its id names. */
  private static createsItsCommunity(
    document: CommunityOperationDocument,
  ): boolean {
    const { nonce } = document.args;

    try {
      return (
        typeof nonce === 'string' &&
        document.communityId ===
          CommitmentId.community(
            document.networkId,
            IdentityId.normalize(document.authorIdentityId),
            nonce,
          )
      );
    } catch {
      return false;
    }
  }

  /**
   * Whether `document`, content addressed by `hash`, is an operation of
   * `communityId` signed by its author, and a genesis exactly when parentless.
   */
  private static proves(
    document: CommunityOperationDocument,
    communityId: string,
    hash: string,
  ): boolean {
    const genesis = document.action === CommunityOperation.GENESIS;

    return (
      document.communityId === communityId &&
      genesis === (document.parents.length === 0) &&
      document.id === `community:${communityId}:op:${hash}` &&
      CommunityOperationProof.isSignedByAuthor(document) &&
      (!genesis || CommunityOperationProof.createsItsCommunity(document))
    );
  }

  /** What the author of `document` signed: all but its id and signature. */
  public static contentOf(
    document: CommunityOperationDocument,
  ): CommunityOperationContent {
    return {
      action: document.action,
      args: document.args,
      authorIdentityId: document.authorIdentityId,
      communityId: document.communityId,
      createdAt: document.createdAt,
      networkId: document.networkId,
      parents: document.parents,
      scopeType: document.scopeType,
    };
  }

  /** The stored operation the author's identity key signs into being. */
  public static seal(
    content: CommunityOperationContent,
    keyPair: KeyPair,
  ): CommunityOperationDocument {
    const id = `community:${content.communityId}:op:${CommunityOperationProof.digestOf(content)}`;

    return {
      ...content,
      id,
      identitySignature: CommunityOperationSignature.sign(
        id,
        new PrivateKey(keyPair.toPrimitives().privateKey),
      ).toString(),
    };
  }

  /**
   * The operation `document` proves for `communityId`, or `undefined` when it
   * is malformed, not content addressed, not signed by its author's identity
   * key, of another community, or a genesis of a community it does not
   * derive. Never throws: a node serves anything.
   */
  public static open(
    document: unknown,
    communityId: string,
  ): CommunityOperation | undefined {
    if (!CommunityOperationProof.isDocument(document)) return undefined;

    const content = CommunityOperationProof.contentOf(document);
    const hash = CommunityOperationProof.safeDigestOf(content);

    if (hash === undefined) return undefined;

    if (!CommunityOperationProof.proves(document, communityId, hash)) {
      return undefined;
    }

    return CommunityOperation.fromPrimitives({
      action: content.action,
      args: content.args,
      authorIdentityId: IdentityId.normalize(content.authorIdentityId),
      communityId: content.communityId,
      createdAt: content.createdAt,
      hash,
      networkId: content.networkId,
      parents: content.parents,
    });
  }
}
