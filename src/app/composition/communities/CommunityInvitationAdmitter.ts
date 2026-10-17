import type { PigeonCommunitiesGateway } from '../../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';
import type { PigeonCommunityOperationsApi } from '../../../contexts/communities/infrastructure/http/PigeonCommunityOperationsApi';
import type { CommunityInvitationClaimResource } from '../../../contexts/communities/infrastructure/http/resources/CommunityInvitationClaimResource';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';

import {
  CommunityOperationFold,
  type CommunityOperationFoldState,
} from '../../../contexts/communities/domain/operations/CommunityOperationFold';

/** The permission that admits members. */
const MANAGE_MEMBERS = 'manage_members';

/**
 * Admits the claimants of a community's invitations on behalf of a member who
 * manages members. Each claim is judged against the community's signed
 * history as this client folds it, never as the node says: a claim the
 * history would not admit (no live invitation, a window that has closed, a
 * bad proof, a non-canonical identity) is left alone, so the manager never
 * signs an admission the other members would reject.
 */
export class CommunityInvitationAdmitter {
  public constructor(
    private readonly operations: Pick<PigeonCommunityOperationsApi, 'list'>,
    private readonly invitations: Pick<
      PigeonCommunitiesGateway,
      'admitCommunityInvitationClaim' | 'listCommunityInvitationClaims'
    >,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private admits(
    state: CommunityOperationFoldState,
    claim: CommunityInvitationClaimResource,
  ): boolean {
    const { authority } = state;
    const invitation = state.invitations.find(claim.invitationId);

    if (!authority || !invitation?.isOpenAt(this.now())) return false;

    try {
      invitation.assertAdmits(
        authority,
        claim.identityId,
        claim.possession,
        claim.consent,
      );

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Admits every pending claim the history admits; others stay pending. The
   * history is folded again after each admission, so a claim past the uses
   * left is not signed.
   */
  public async admitPending(
    session: Session,
    communityId: string,
  ): Promise<void> {
    const fold = async () =>
      CommunityOperationFold.state(
        await this.operations.list(session, communityId),
      );
    let state = await fold();

    if (!state.authority?.hasPermission(session.identity.id, MANAGE_MEMBERS)) {
      return;
    }

    for (const claim of await this.invitations.listCommunityInvitationClaims(
      session,
      communityId,
    )) {
      if (claim.communityId !== communityId || !this.admits(state, claim)) {
        continue;
      }

      // One failing admission does not hold the others back.
      const admitted = await this.invitations
        .admitCommunityInvitationClaim(session, claim)
        .then(() => true)
        .catch(() => false);

      if (admitted) state = await fold();
    }
  }
}
