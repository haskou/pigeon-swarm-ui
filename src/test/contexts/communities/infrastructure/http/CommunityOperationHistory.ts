import type { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { CommunityOperation } from '../../../../../contexts/communities/domain/operations/CommunityOperation';
import type { CommunityOperationDocument } from '../../../../../contexts/communities/infrastructure/http/CommunityOperationDocument';
import type { CommunityOperationAuthor } from './CommunityOperationAuthor';

import { CommunityRoleId } from '../../../../../contexts/communities/domain/value-objects/CommunityRoleId';
import { CommunityOperationProof } from '../../../../../contexts/communities/infrastructure/http/CommunityOperationProof';
import { deriveCommunityId } from '../../../../../contexts/communities/infrastructure/http/deriveCommunityRecordId';

const NETWORK = 'network-1';
const NONCE = 'nonce-1';

/**
 * The signed history of one community as a node would serve it: each
 * operation builds on the one before it and is sealed by its author's
 * identity key, unless a spec seals it with another key to forge it.
 */
export class CommunityOperationHistory {
  public readonly communityId: string;

  public readonly documents: CommunityOperationDocument[] = [];

  /** The digest an operation's children name it by. */
  public static digestOf(document: CommunityOperationDocument): string {
    return document.id.split(':op:')[1];
  }

  public constructor(owner: CommunityOperationAuthor) {
    this.communityId = deriveCommunityId(NETWORK, owner.id, NONCE);
    this.append(owner, 'community_created', {
      autoJoinEnabled: false,
      description: 'A community',
      discoverable: false,
      name: 'Community',
      nonce: NONCE,
      visibility: 'public',
    });
  }

  /**
   * Seals the next operation on top of `parents`, the latest one unless
   * given; `keyPair` other than the author's forges it.
   */
  public append(
    author: CommunityOperationAuthor,
    action: string,
    args: Record<string, unknown>,
    keyPair: KeyPair = author.keyPair,
    parents?: readonly string[],
  ): CommunityOperationDocument {
    const previous = this.documents[this.documents.length - 1] as
      | CommunityOperationDocument
      | undefined;
    const latest = previous
      ? [CommunityOperationHistory.digestOf(previous)]
      : [];
    const document = CommunityOperationProof.seal(
      {
        action,
        args,
        authorIdentityId: author.id,
        communityId: this.communityId,
        createdAt: this.documents.length + 1,
        networkId: NETWORK,
        parents: [...(parents ?? latest)],
        scopeType: 'community_operation',
      },
      keyPair,
    );

    this.documents.push(document);

    return document;
  }

  /** `author` adds `member`, as a manager does. */
  public add(
    author: CommunityOperationAuthor,
    member: CommunityOperationAuthor,
  ): void {
    this.append(author, 'member_joined', {
      identityId: member.id,
      method: 'added',
    });
  }

  /** `author` creates a role with these permissions; returns its id. */
  public createRole(
    author: CommunityOperationAuthor,
    permissions: string[],
  ): string {
    const roleId = CommunityRoleId.derive(
      this.communityId,
      author.id,
      this.documents.length + 1,
    ).valueOf();

    this.append(author, 'role_created', { name: 'Role', permissions, roleId });

    return roleId;
  }

  /**
   * `author` creates a role on top of `parents`, concurrent with whatever
   * else descends from them; returns the operation's digest.
   */
  public branch(
    author: CommunityOperationAuthor,
    parents: readonly string[],
  ): string {
    const roleId = CommunityRoleId.derive(
      this.communityId,
      author.id,
      this.documents.length + 1,
    ).valueOf();

    return CommunityOperationHistory.digestOf(
      this.append(
        author,
        'role_created',
        { name: 'Branch', permissions: [], roleId },
        author.keyPair,
        parents,
      ),
    );
  }

  /** `author` gives `member` exactly these roles. */
  public assign(
    author: CommunityOperationAuthor,
    member: CommunityOperationAuthor,
    roleIds: string[],
  ): void {
    this.append(author, 'member_roles_updated', {
      identityId: member.id,
      roleIds,
    });
  }

  /** `author` kicks `member` out, as a manager does. */
  public kick(
    author: CommunityOperationAuthor,
    member: CommunityOperationAuthor,
  ): void {
    this.append(author, 'member_kicked', { identityId: member.id });
  }

  /** The operations a member opens from what the node serves. */
  public operations(): CommunityOperation[] {
    return this.documents.flatMap(
      (document) =>
        CommunityOperationProof.open(document, this.communityId) ?? [],
    );
  }
}
