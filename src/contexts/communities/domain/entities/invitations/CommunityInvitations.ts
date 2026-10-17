import type { CommunityOperation } from '../../operations/CommunityOperation';

import { IdentityId } from '../../../../identities/domain/value-objects/IdentityId';
import { CommunityInvitation } from './CommunityInvitation';

/**
 * The invitations of one set of community operations, by id and by key.
 * Immutable: each change returns a new collection and leaves the invitations
 * it does not touch shared.
 */
export class CommunityInvitations {
  public static readonly EMPTY = new CommunityInvitations(new Map(), new Map());

  private constructor(
    private readonly invitations: ReadonlyMap<string, CommunityInvitation>,
    /** The first invitation issued with each key, so a lookup never scans. */
    private readonly idsByKey: ReadonlyMap<string, string>,
  ) {}

  private with(invitation: CommunityInvitation): CommunityInvitations {
    const key = invitation.getInvitationKey();

    return new CommunityInvitations(
      new Map(this.invitations).set(invitation.getId(), invitation),
      this.idsByKey.has(key)
        ? this.idsByKey
        : new Map(this.idsByKey).set(key, invitation.getId()),
    );
  }

  /** The known invitation `operation` names, if any. */
  private invitationOf(
    operation: CommunityOperation,
  ): CommunityInvitation | undefined {
    const { invitationId } = operation.getArguments();

    return typeof invitationId === 'string'
      ? this.invitations.get(invitationId)
      : undefined;
  }

  /** A revocation, or an admission valid at its causal past, on `invitation` */
  private settled(
    operation: CommunityOperation,
    invitation: CommunityInvitation,
    applied: boolean,
    valid: boolean,
  ): CommunityInvitations {
    if (applied && operation.getAction() === 'invitation_revoked') {
      return this.with(invitation.revoked());
    }

    const { identityId } = operation.getArguments();

    return valid &&
      CommunityInvitation.isAdmission(operation) &&
      typeof identityId === 'string'
      ? this.with(invitation.withJoiner(IdentityId.normalize(identityId)))
      : this;
  }

  public find(id: string): CommunityInvitation | undefined {
    return this.invitations.get(id);
  }

  public findByKey(invitationKey: string): CommunityInvitation | undefined {
    const id = this.idsByKey.get(invitationKey);

    return id === undefined ? undefined : this.invitations.get(id);
  }

  public list(): CommunityInvitation[] {
    return [...this.invitations.values()];
  }

  /**
   * The invitations once `operation` is taken: an `applied`
   * `invitation_created` issues an invitation and an `applied`
   * `invitation_revoked` closes one. An admission `valid` at its causal past
   * counts as a use of the invitation, even when the linear fold skips or
   * voids it, so concurrent admissions never exceed what each one saw.
   */
  public after(
    operation: CommunityOperation,
    applied: boolean,
    valid: boolean,
  ): CommunityInvitations {
    const action = operation.getAction();

    if (applied && action === 'invitation_created') {
      return this.with(CommunityInvitation.fromOperation(operation));
    }

    const invitation = this.invitationOf(operation);

    if (!invitation) return this;

    return valid || (applied && action === 'invitation_revoked')
      ? this.settled(operation, invitation, applied, valid)
      : this;
  }

  /** Marks as cut every invitation `isCut` tells. */
  public cutWhere(
    isCut: (invitation: CommunityInvitation) => boolean,
  ): CommunityInvitations {
    return new CommunityInvitations(
      new Map(
        [...this.invitations].map(([id, invitation]) => [
          id,
          isCut(invitation) ? invitation.cut() : invitation,
        ]),
      ),
      this.idsByKey,
    );
  }
}
