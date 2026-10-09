import type { CommunityTextChannel } from '../../../../../shared/domain/pigeonResources.types';

import { CommunityChannelEncryption } from '../../../../../contexts/communities/presentation/view-models/CommunityChannelEncryption';
import { copy } from '../../../../../shared/presentation/i18n/copy';

const channel = { id: 'channel' } as CommunityTextChannel;

describe('CommunityChannelEncryption', () => {
  describe('ready', () => {
    const base = {
      communityMemberIds: ['me', 'other'],
      currentIdentityId: 'me',
      encryptionState: 'ready' as const,
      memberIdentities: { other: {} },
      selectedChannel: channel,
    };

    it('requires a selected channel', () => {
      expect(
        CommunityChannelEncryption.ready({
          ...base,
          encryptionState: 'public',
          selectedChannel: undefined,
        }),
      ).toBe(false);
    });

    it('is ready for public communities without any group', () => {
      expect(
        CommunityChannelEncryption.ready({
          ...base,
          encryptionState: 'public',
          memberIdentities: {},
        }),
      ).toBe(true);
    });

    it('needs this device in the group and every other member identity', () => {
      expect(CommunityChannelEncryption.ready(base)).toBe(true);
      expect(
        CommunityChannelEncryption.ready({
          ...base,
          encryptionState: 'pending',
        }),
      ).toBe(false);
      expect(
        CommunityChannelEncryption.ready({
          ...base,
          encryptionState: 'checking',
        }),
      ).toBe(false);
      expect(
        CommunityChannelEncryption.ready({ ...base, memberIdentities: {} }),
      ).toBe(false);
    });
  });

  describe('tooltip', () => {
    it('describes public, ready and missing states', () => {
      expect(
        CommunityChannelEncryption.tooltip({
          encryptionState: 'public',
          ready: false,
        }),
      ).toBe(copy.chat.publicChannel);
      expect(
        CommunityChannelEncryption.tooltip({
          encryptionState: 'ready',
          ready: true,
        }),
      ).toBe(copy.chat.e2eReady);
      expect(
        CommunityChannelEncryption.tooltip({
          encryptionState: 'pending',
          ready: false,
        }),
      ).toBe(copy.chat.e2eMissing);
    });
  });

  describe('awaitingGroupAccess', () => {
    it('only reports a device the group has not admitted yet', () => {
      expect(CommunityChannelEncryption.awaitingGroupAccess('pending')).toBe(
        true,
      );
      expect(CommunityChannelEncryption.awaitingGroupAccess('checking')).toBe(
        false,
      );
      expect(CommunityChannelEncryption.awaitingGroupAccess('ready')).toBe(
        false,
      );
      expect(CommunityChannelEncryption.awaitingGroupAccess('public')).toBe(
        false,
      );
    });
  });
});
