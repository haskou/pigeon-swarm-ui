import {
  CommunityInvitationConsent,
  CommunityInvitationFields,
  CommunityInvitationKey,
  CommunityInvitationPossession,
} from '@haskou/pigeon-swarm-crypto';
import { assert } from '@haskou/value-objects';

import type { CommunityAuthority } from '../../operations/CommunityAuthority';
import type { CommunityOperation } from '../../operations/CommunityOperation';

import { IdentityId } from '../../../../identities/domain/value-objects/IdentityId';
import { CommunityOperationRejectedError } from '../../errors/CommunityOperationRejectedError';
import { CommunityOperationArgumentReader } from '../../operations/CommunityOperationArgumentReader';

interface CommunityInvitationAttributes {
  communityId: string;
  createdAt: number;
  expiresAt: number;
  id: string;
  invitationKey: string;
  invitee?: string;
  issuerIdentityId: string;
  maxUses: number;
  networkId: string;
}

/** What the operations of one set say about an invitation. */
interface CommunityInvitationStatus {
  /**
   * A standing cut outside the causal past of the invitation took
   * `create_invites` (or membership) from its issuer.
   */
  cut: boolean;
  /** Distinct identities with a valid admission under the invitation. */
  joinerIds: string[];
  revoked: boolean;
}

export interface CommunityInvitationPrimitives {
  createdAt: number;
  expiresAt: number;
  id: string;
  invitationKey: string;
  invitee?: string;
  issuerIdentityId: string;
  live: boolean;
  maxUses: number;
  revoked: boolean;
  uses: number;
}

/**
 * An invitation, as its `invitation_created` operation states it, with its
 * status in one set of operations. Its id is the operation digest. Only the
 * public invitation key is known here: the secret stays in the link.
 */
export class CommunityInvitation {
  /** Most identities one invitation admits. */
  public static readonly MAX_USES = 100;

  /** Longest life of an invitation after its `createdAt`: 30 days. */
  public static readonly MAX_LIFETIME = 2_592_000_000;

  private static invitationKeyOf(value: string): string {
    try {
      return CommunityInvitationKey.parsePublicKey(value);
    } catch {
      throw new CommunityOperationRejectedError();
    }
  }

  /** Whether `operation` admits a member under an invitation. */
  public static isAdmission(operation: CommunityOperation): boolean {
    return (
      operation.getAction() === 'member_joined' &&
      operation.getArguments().method === 'invitation'
    );
  }

  /**
   * Reads an `invitation_created` operation; throws when its arguments break
   * a rule of the invitation itself, whoever authors it.
   */
  public static fromOperation(
    operation: CommunityOperation,
  ): CommunityInvitation {
    const reader = new CommunityOperationArgumentReader(
      operation.getArguments(),
      ['expiresAt', 'invitationKey', 'maxUses'],
      ['invitee'],
    );
    const maxUses = reader.integer('maxUses');
    const expiresAt = reader.integer('expiresAt');
    const invitee = reader.optionalString('invitee');
    const createdAt = operation.getCreatedAt();

    assert(
      maxUses >= 1 &&
        maxUses <= CommunityInvitation.MAX_USES &&
        (invitee === undefined ||
          (maxUses === 1 && IdentityId.isCanonical(invitee))) &&
        expiresAt > createdAt &&
        expiresAt <= createdAt + CommunityInvitation.MAX_LIFETIME,
      new CommunityOperationRejectedError(),
    );

    return new CommunityInvitation(
      {
        communityId: operation.getCommunityId(),
        createdAt,
        expiresAt,
        id: operation.getHash(),
        invitationKey: CommunityInvitation.invitationKeyOf(
          reader.string('invitationKey'),
        ),
        invitee:
          invitee === undefined ? undefined : IdentityId.normalize(invitee),
        issuerIdentityId: IdentityId.normalize(operation.getAuthorIdentityId()),
        maxUses,
        networkId: operation.getNetworkId(),
      },
      { cut: false, joinerIds: [], revoked: false },
    );
  }

  private constructor(
    private readonly attributes: CommunityInvitationAttributes,
    private readonly status: CommunityInvitationStatus,
  ) {}

  public getId(): string {
    return this.attributes.id;
  }

  public getIssuerIdentityId(): string {
    return this.attributes.issuerIdentityId;
  }

  public getInvitationKey(): string {
    return this.attributes.invitationKey;
  }

  public isRevoked(): boolean {
    return this.status.revoked;
  }

  public hasJoined(joinerId: string): boolean {
    return this.status.joinerIds.includes(joinerId);
  }

  /** Whether `at` lies in the window `[createdAt, expiresAt]`. */
  public isOpenAt(at: number): boolean {
    return at >= this.attributes.createdAt && at <= this.attributes.expiresAt;
  }

  /**
   * Whether a new admission may use the invitation in a set of operations
   * whose folded authority is `authority`: not revoked, its issuer's
   * `create_invites` never cut since issuing, uses left, and the issuer
   * still holding `create_invites`.
   */
  public isLiveIn(authority: CommunityAuthority): boolean {
    return (
      !this.status.revoked &&
      !this.status.cut &&
      this.status.joinerIds.length < this.attributes.maxUses &&
      authority.hasPermission(
        this.attributes.issuerIdentityId,
        'create_invites',
      )
    );
  }

  /** What the possession and consent proofs of `joinerId` sign. */
  public fieldsFor(joinerId: string): CommunityInvitationFields {
    return {
      communityId: this.attributes.communityId,
      identityId: joinerId,
      invitationId: this.attributes.id,
      networkId: this.attributes.networkId,
    };
  }

  /**
   * Throws unless the invitation is live in `authority` and lets `joinerId`
   * in with these proofs: a canonical id, the `invitee` when it names one,
   * a first use by this identity, a possession proof by the invitation key
   * and the joiner's consent. The window is not checked here.
   */
  public assertAdmits(
    authority: CommunityAuthority,
    joinerId: string,
    possession: string,
    consent: string,
  ): void {
    const { invitee } = this.attributes;

    assert(
      this.isLiveIn(authority) &&
        IdentityId.isCanonical(joinerId) &&
        (invitee === undefined || invitee === IdentityId.normalize(joinerId)) &&
        !this.hasJoined(IdentityId.normalize(joinerId)),
      new CommunityOperationRejectedError(),
    );

    try {
      CommunityInvitationPossession.verify(
        this.fieldsFor(joinerId),
        possession,
        this.attributes.invitationKey,
      );
      CommunityInvitationConsent.verify(this.fieldsFor(joinerId), consent);
    } catch {
      throw new CommunityOperationRejectedError();
    }
  }

  public withJoiner(joinerId: string): CommunityInvitation {
    return this.status.joinerIds.includes(joinerId)
      ? this
      : new CommunityInvitation(this.attributes, {
          ...this.status,
          joinerIds: [...this.status.joinerIds, joinerId],
        });
  }

  public revoked(): CommunityInvitation {
    return new CommunityInvitation(this.attributes, {
      ...this.status,
      revoked: true,
    });
  }

  public cut(): CommunityInvitation {
    return new CommunityInvitation(this.attributes, {
      ...this.status,
      cut: true,
    });
  }

  public toPrimitives(
    authority: CommunityAuthority,
  ): CommunityInvitationPrimitives {
    return {
      ...this.attributes,
      live: this.isLiveIn(authority),
      revoked: this.status.revoked,
      uses: this.status.joinerIds.length,
    };
  }
}
