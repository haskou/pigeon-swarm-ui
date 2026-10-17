import {
  CommunityInvitationConsent,
  CommunityInvitationFields,
  CommunityInvitationKey,
  PrivateKey,
} from '@haskou/pigeon-swarm-crypto';
import { createHash } from 'crypto';

import { CommunityOperation } from '../../../../../contexts/communities/domain/operations/CommunityOperation';
import { CommunityRoleId } from '../../../../../contexts/communities/domain/value-objects/CommunityRoleId';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';

const identityKeys = new Map<string, PrivateKey>();

function digestOf(text: string): string {
  return createHash('sha256').update(text).digest('base64url');
}

/** Fixed seeds keep digests, and so the fold's order, stable across runs. */
function identity(label: string): string {
  const key = PrivateKey.fromSeed(createHash('sha256').update(label).digest());
  const identityId = IdentityId.fromString(
    key.getPublicKey().toString(),
  ).valueOf();

  identityKeys.set(identityId, key);

  return identityId;
}

export const owner = identity('owner');
export const alice = identity('alice');
export const mallory = identity('mallory');
export const bob = identity('bob');
export const carol = identity('carol');
export const communityId = 'community-1';
export const networkId = '550e8400-e29b-41d4-a716-446655440000';
export const DAY = 86_400_000;

export function privateKeyOf(identityId: string): PrivateKey {
  const key = identityKeys.get(identityId);

  if (!key) throw new Error('No identity key for the fixture identity');

  return key;
}

/** An operation whose hash is the digest of its content, as nodes make it. */
export function operation(
  action: string,
  author: string,
  args: Record<string, unknown>,
  parents: CommunityOperation[],
  createdAt = 1,
): CommunityOperation {
  const attributes = {
    action,
    args,
    authorIdentityId: author,
    communityId,
    createdAt,
    networkId,
    parents: parents.map((parent) => parent.getHash()).sort(),
  };

  return CommunityOperation.fromPrimitives({
    ...attributes,
    hash: digestOf(JSON.stringify(attributes)),
  });
}

export function genesis(autoJoinEnabled = false): CommunityOperation {
  return operation(
    CommunityOperation.GENESIS,
    owner,
    {
      autoJoinEnabled,
      description: 'A community',
      discoverable: true,
      name: 'Community',
      nonce: 'genesis-nonce',
      visibility: 'public',
    },
    [],
  );
}

export function join(
  parents: CommunityOperation[],
  member: string,
  author = owner,
): CommunityOperation {
  return operation(
    'member_joined',
    author,
    { identityId: member, method: 'added' },
    parents,
  );
}

export function kick(
  parents: CommunityOperation[],
  member: string,
  author = owner,
  createdAt = 1,
): CommunityOperation {
  return operation(
    'member_kicked',
    author,
    { identityId: member },
    parents,
    createdAt,
  );
}

export function ban(
  parents: CommunityOperation[],
  member: string,
  author = owner,
): CommunityOperation {
  return operation('member_banned', author, { identityId: member }, parents);
}

export function leave(
  parents: CommunityOperation[],
  member: string,
): CommunityOperation {
  return operation('member_left', member, { identityId: member }, parents);
}

/** A role holding `permissions`, created by `author` at `createdAt`. */
export function role(
  parents: CommunityOperation[],
  permissions: string[],
  createdAt = 1,
  author = owner,
): CommunityOperation {
  return operation(
    'role_created',
    author,
    {
      name: `role-${createdAt}`,
      permissions,
      roleId: CommunityRoleId.derive(communityId, author, createdAt).valueOf(),
    },
    parents,
    createdAt,
  );
}

export function assignRoles(
  parents: CommunityOperation[],
  member: string,
  roles: CommunityOperation[],
  author = owner,
  createdAt = 1,
): CommunityOperation {
  return operation(
    'member_roles_updated',
    author,
    {
      identityId: member,
      roleIds: roles.map((created) => String(created.getArguments().roleId)),
    },
    parents,
    createdAt,
  );
}

export interface Invitation {
  key: CommunityInvitationKey;
  operation: CommunityOperation;
}

/**
 * An `invitation_created` valid for 7 days and 5 uses unless `args` says
 * otherwise. The key comes from `label`, so two invitations share a key only
 * when they share a label.
 */
export function invitation(
  parents: CommunityOperation[],
  author = owner,
  args: Record<string, unknown> = {},
  createdAt = 1,
  label = `invitation:${author}:${createdAt}`,
): Invitation {
  const key = CommunityInvitationKey.fromSecret(digestOf(label));

  return {
    key,
    operation: operation(
      'invitation_created',
      author,
      {
        expiresAt: createdAt + 7 * DAY,
        invitationKey: key.publicKey(),
        maxUses: 5,
        ...args,
      },
      parents,
      createdAt,
    ),
  };
}

export function invitationFieldsOf(
  invited: CommunityOperation,
  joiner: string,
): CommunityInvitationFields {
  return {
    communityId,
    identityId: joiner,
    invitationId: invited.getHash(),
    networkId,
  };
}

/** The admission of `joiner` under `invited`, with both of its proofs. */
export function admission(
  parents: CommunityOperation[],
  invited: Invitation,
  joiner: string,
  author = owner,
  createdAt = 2,
  args: Record<string, unknown> = {},
): CommunityOperation {
  const fields = invitationFieldsOf(invited.operation, joiner);

  return operation(
    'member_joined',
    author,
    {
      consent: CommunityInvitationConsent.sign(fields, privateKeyOf(joiner)),
      identityId: joiner,
      invitationId: invited.operation.getHash(),
      method: 'invitation',
      possession: invited.key.signPossession(fields),
      ...args,
    },
    parents,
    createdAt,
  );
}

export function revoke(
  parents: CommunityOperation[],
  invited: Invitation,
  author = owner,
): CommunityOperation {
  return operation(
    'invitation_revoked',
    author,
    { invitationId: invited.operation.getHash() },
    parents,
  );
}
