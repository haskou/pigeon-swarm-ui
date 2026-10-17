import { CommunityInvitationConsent } from '@haskou/pigeon-swarm-crypto';
import { type MockProxy, mock } from 'jest-mock-extended';

import type { PigeonCommunitiesGateway } from '../../../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';
import type { PigeonCommunityOperationsApi } from '../../../../contexts/communities/infrastructure/http/PigeonCommunityOperationsApi';
import type { CommunityInvitationClaimResource } from '../../../../contexts/communities/infrastructure/http/resources/CommunityInvitationClaimResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { CommunityInvitationAdmitter } from '../../../../app/composition/communities/CommunityInvitationAdmitter';
import {
  alice,
  bob,
  communityId,
  genesis,
  invitation,
  invitationFieldsOf,
  Invitation,
  join,
  owner,
  privateKeyOf,
} from '../../../contexts/communities/domain/operations/CommunityOperationFixtures';

const NOW = 20;

describe(CommunityInvitationAdmitter.name, () => {
  const created = genesis();
  const aliceJoins = join([created], alice);
  const invited = invitation([aliceJoins], owner, {}, 10);
  const history = [created, aliceJoins, invited.operation];

  function claimOf(
    joiner: string,
    from: Invitation = invited,
    possessed: Invitation = invited,
  ): CommunityInvitationClaimResource {
    const fields = invitationFieldsOf(from.operation, joiner);

    return {
      communityId,
      consent: CommunityInvitationConsent.sign(fields, privateKeyOf(joiner)),
      id: `invitation-claim:${fields.invitationId}:${joiner}`,
      identityId: joiner,
      invitationId: fields.invitationId,
      possession: possessed.key.signPossession(fields),
    };
  }

  function admitterFor(
    claims: CommunityInvitationClaimResource[],
    now = NOW,
  ): {
    admitter: CommunityInvitationAdmitter;
    gateway: MockProxy<PigeonCommunitiesGateway>;
  } {
    const operations = mock<PigeonCommunityOperationsApi>();
    const gateway = mock<PigeonCommunitiesGateway>();

    operations.list.mockResolvedValue(history);
    gateway.listCommunityInvitationClaims.mockResolvedValue(claims);
    gateway.admitCommunityInvitationClaim.mockResolvedValue(undefined);

    return {
      admitter: new CommunityInvitationAdmitter(operations, gateway, () => now),
      gateway,
    };
  }

  function sessionOf(identityId: string): Session {
    return { identity: { id: identityId } } as unknown as Session;
  }

  it('admits a claim its own fold of the history admits', async () => {
    const claim = claimOf(bob);
    const { admitter, gateway } = admitterFor([claim]);
    const session = sessionOf(owner);

    await admitter.admitPending(session, communityId);

    expect(gateway.admitCommunityInvitationClaim).toHaveBeenCalledWith(
      session,
      claim,
    );
  });

  it('leaves a claim whose possession proof is of another key', async () => {
    const other = invitation([aliceJoins], owner, {}, 10, 'other');
    const { admitter, gateway } = admitterFor([claimOf(bob, invited, other)]);

    await admitter.admitPending(sessionOf(owner), communityId);

    expect(gateway.admitCommunityInvitationClaim).not.toHaveBeenCalled();
  });

  it('leaves a claim past the invitation expiry', async () => {
    const { admitter, gateway } = admitterFor(
      [claimOf(bob)],
      10 + 8 * 86_400_000,
    );

    await admitter.admitPending(sessionOf(owner), communityId);

    expect(gateway.admitCommunityInvitationClaim).not.toHaveBeenCalled();
  });

  it('leaves a claim of an identity id that is not canonical', async () => {
    const claim = { ...claimOf(bob), identityId: 'Not-Canonical' };
    const { admitter, gateway } = admitterFor([claim]);

    await admitter.admitPending(sessionOf(owner), communityId);

    expect(gateway.admitCommunityInvitationClaim).not.toHaveBeenCalled();
  });

  it('does nothing for a member who cannot manage members', async () => {
    const { admitter, gateway } = admitterFor([claimOf(bob)]);

    await admitter.admitPending(sessionOf(alice), communityId);

    expect(gateway.listCommunityInvitationClaims).not.toHaveBeenCalled();
    expect(gateway.admitCommunityInvitationClaim).not.toHaveBeenCalled();
  });
});
