import { mock, type MockProxy } from 'jest-mock-extended';

import type { PigeonCommunityManagement } from '../../../app/composition/communities/PigeonCommunityManagement';
import type { PigeonMlsFacade } from '../../../app/composition/mls/PigeonMlsFacade';
import type { PigeonCommunitiesGateway } from '../../../contexts/communities/infrastructure/http/PigeonCommunitiesGateway';
import type { CommunityChannelResource } from '../../../contexts/communities/infrastructure/http/resources/CommunityChannelResource';
import type { CommunityResource } from '../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { PigeonIdentitiesGateway } from '../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';

import { PigeonCommunitiesFacade } from '../../../app/composition/PigeonCommunitiesFacade';
import { CommunityChannelRestrictionRefusedError } from '../../../contexts/communities/domain/errors/CommunityChannelRestrictionRefusedError';

const ROLES = ['role-1'];

describe('PigeonCommunitiesFacade', () => {
  const session = mock<Session>();
  const channel = mock<CommunityChannelResource>();
  let management: MockProxy<PigeonCommunityManagement>;
  let mls: MockProxy<PigeonMlsFacade>;
  let facade: PigeonCommunitiesFacade;

  const visibility = (value: CommunityResource['visibility']): void => {
    management.find.mockResolvedValue(
      mock<CommunityResource>({ visibility: value }),
    );
  };

  beforeEach(() => {
    management = mock<PigeonCommunityManagement>();
    mls = mock<PigeonMlsFacade>();
    management.updateChannelPermissions.mockResolvedValue(channel);
    facade = new PigeonCommunitiesFacade(
      mock<PigeonCommunitiesGateway>(),
      mock<PigeonIdentitiesGateway>(),
      mls,
      management,
    );
  });

  describe('updateChannelPermissions', () => {
    it('opens the channel group once the restriction is signed', async () => {
      visibility('private');

      await expect(
        facade.updateChannelPermissions(session, 'community-1', 'c-1', ROLES),
      ).resolves.toBe(channel);

      expect(mls.assertCanRestrictChannel).toHaveBeenCalledWith(
        session,
        'community-1',
        ROLES,
      );
      expect(management.updateChannelPermissions).toHaveBeenCalledWith(
        session,
        'community-1',
        'c-1',
        ROLES,
      );
      expect(mls.openChannelGroup).toHaveBeenCalledWith(
        session,
        'community-1',
        'c-1',
      );
      expect(
        mls.assertCanRestrictChannel.mock.invocationCallOrder[0],
      ).toBeLessThan(
        management.updateChannelPermissions.mock.invocationCallOrder[0],
      );
      expect(
        management.updateChannelPermissions.mock.invocationCallOrder[0],
      ).toBeLessThan(mls.openChannelGroup.mock.invocationCallOrder[0]);
    });

    it('signs nothing when this identity could not key the channel', async () => {
      visibility('private');
      mls.assertCanRestrictChannel.mockRejectedValue(
        new CommunityChannelRestrictionRefusedError(),
      );

      await expect(
        facade.updateChannelPermissions(session, 'community-1', 'c-1', ROLES),
      ).rejects.toBeInstanceOf(CommunityChannelRestrictionRefusedError);

      expect(management.updateChannelPermissions).not.toHaveBeenCalled();
      expect(mls.openChannelGroup).not.toHaveBeenCalled();
    });

    it('keeps public communities out of MLS', async () => {
      visibility('public');

      await facade.updateChannelPermissions(
        session,
        'community-1',
        'c-1',
        ROLES,
      );

      expect(management.updateChannelPermissions).toHaveBeenCalled();
      expect(mls.assertCanRestrictChannel).not.toHaveBeenCalled();
      expect(mls.openChannelGroup).not.toHaveBeenCalled();
    });
  });
});
