import type { CommunityTextChannel } from '../../../../../shared/domain/pigeonResources.types';

import { CommunityChannelEncryption } from '../../../../../contexts/communities/presentation/view-models/CommunityChannelEncryption';
import { copy } from '../../../../../shared/presentation/i18n/copy';

const channel = { id: 'channel' } as CommunityTextChannel;

describe('CommunityChannelEncryption', () => {
  describe('ready', () => {
    const base = {
      communityIsPublic: false,
      communityKey: {},
      communityMemberIds: ['me', 'other'],
      currentIdentityId: 'me',
      memberIdentities: { other: {} },
      selectedChannel: channel,
    };

    it('requires a selected channel', () => {
      expect(
        CommunityChannelEncryption.ready({
          ...base,
          communityIsPublic: true,
          selectedChannel: undefined,
        }),
      ).toBe(false);
    });

    it('is ready for public communities without a key', () => {
      expect(
        CommunityChannelEncryption.ready({
          ...base,
          communityIsPublic: true,
          communityKey: undefined,
        }),
      ).toBe(true);
    });

    it('needs the key and every other member identity when private', () => {
      expect(CommunityChannelEncryption.ready(base)).toBe(true);
      expect(
        CommunityChannelEncryption.ready({ ...base, communityKey: undefined }),
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
          communityIsPublic: true,
          ready: false,
        }),
      ).toBe(copy.chat.publicChannel);
      expect(
        CommunityChannelEncryption.tooltip({
          communityIsPublic: false,
          ready: true,
        }),
      ).toBe(copy.chat.e2eReady);
      expect(
        CommunityChannelEncryption.tooltip({
          communityIsPublic: false,
          ready: false,
        }),
      ).toBe(copy.chat.e2eMissing);
    });
  });

  describe('missingCommunityKey', () => {
    const base = {
      communityIsPublic: false,
      communityKey: undefined,
      owner: true,
      visibleMessages: [] as { encrypted?: boolean }[],
    };

    it('is never missing for public communities or when the key exists', () => {
      expect(
        CommunityChannelEncryption.missingCommunityKey({
          ...base,
          communityIsPublic: true,
          owner: false,
        }),
      ).toBe(false);
      expect(
        CommunityChannelEncryption.missingCommunityKey({
          ...base,
          communityKey: {},
          owner: false,
        }),
      ).toBe(false);
    });

    it('is missing for non-owners without a key', () => {
      expect(
        CommunityChannelEncryption.missingCommunityKey({
          ...base,
          owner: false,
        }),
      ).toBe(true);
    });

    it('is missing for owners only when every visible message is encrypted', () => {
      expect(CommunityChannelEncryption.missingCommunityKey(base)).toBe(false);
      expect(
        CommunityChannelEncryption.missingCommunityKey({
          ...base,
          visibleMessages: [{ encrypted: true }, { encrypted: true }],
        }),
      ).toBe(true);
      expect(
        CommunityChannelEncryption.missingCommunityKey({
          ...base,
          visibleMessages: [{ encrypted: true }, { encrypted: false }],
        }),
      ).toBe(false);
    });
  });
});
