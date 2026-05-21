import type { CommunityTextChannel } from '../../../../shared/domain/pigeonResources.types';

import { ManagedCommunityChannels } from './ManagedCommunityChannels';

const textChannel: CommunityTextChannel = {
  createdAt: 1,
  id: 'channel-1',
  name: 'general',
  permissions: { visibleRoleIds: ['everyone'] },
  type: 'text',
};
const opsTextChannel: CommunityTextChannel = {
  createdAt: 2,
  id: 'channel-2',
  name: 'ops',
  permissions: { visibleRoleIds: ['everyone'] },
  type: 'text',
};

const inputDefaults = {
  channelDrafts: { 'channel-1': 'general' },
  channelPermissionDrafts: { 'channel-1': ['everyone'] },
  deletedChannelIds: [],
  originalChannelIds: ['channel-1'],
};

describe(ManagedCommunityChannels.name, () => {
  it('does not report changes for untouched existing channels', () => {
    expect(
      ManagedCommunityChannels.hasChanges({
        ...inputDefaults,
        channelOrder: [textChannel],
      }),
    ).toBe(false);
  });

  it('reports changes for renamed channels', () => {
    expect(
      ManagedCommunityChannels.hasChanges({
        ...inputDefaults,
        channelDrafts: { 'channel-1': 'ops' },
        channelOrder: [textChannel],
      }),
    ).toBe(true);
  });

  it('reports changes for updated channel visibility', () => {
    expect(
      ManagedCommunityChannels.hasChanges({
        ...inputDefaults,
        channelOrder: [textChannel],
        channelPermissionDrafts: { 'channel-1': ['role-1'] },
      }),
    ).toBe(true);
  });

  it('reports changes for reordered channels', () => {
    expect(
      ManagedCommunityChannels.hasChanges({
        channelDrafts: { 'channel-1': 'general', 'channel-2': 'ops' },
        channelOrder: [opsTextChannel, textChannel],
        channelPermissionDrafts: {
          'channel-1': ['everyone'],
          'channel-2': ['everyone'],
        },
        deletedChannelIds: [],
        originalChannelIds: ['channel-1', 'channel-2'],
      }),
    ).toBe(true);
  });

  it('treats role visibility as an unordered set', () => {
    expect(
      ManagedCommunityChannels.hasChanges({
        ...inputDefaults,
        channelOrder: [
          {
            ...textChannel,
            permissions: { visibleRoleIds: ['role-2', 'role-1'] },
          },
        ],
        channelPermissionDrafts: { 'channel-1': ['role-1', 'role-2'] },
      }),
    ).toBe(false);
  });

  it('orders saved channels using the managed draft order', () => {
    expect(
      ManagedCommunityChannels.orderSavedChannels(
        [textChannel, opsTextChannel],
        {
          channelDrafts: { 'channel-1': 'general', 'channel-2': 'ops' },
          channelOrder: [opsTextChannel, textChannel],
          channelPermissionDrafts: {
            'channel-1': ['everyone'],
            'channel-2': ['everyone'],
          },
          deletedChannelIds: [],
          originalChannelIds: ['channel-1', 'channel-2'],
        },
      ),
    ).toEqual([opsTextChannel, textChannel]);
  });

  it('keeps newly-created channels at their draft position', () => {
    const createdTextChannel: CommunityTextChannel = {
      createdAt: 3,
      id: 'channel-3',
      name: 'new',
      type: 'text',
    };

    expect(
      ManagedCommunityChannels.orderSavedChannels(
        [textChannel, opsTextChannel, createdTextChannel],
        {
          channelDrafts: {
            'channel-1': 'general',
            'channel-2': 'ops',
            'draft:channel-3': 'new',
          },
          channelOrder: [
            opsTextChannel,
            { ...createdTextChannel, id: 'draft:channel-3', pending: true },
            textChannel,
          ],
          channelPermissionDrafts: {
            'channel-1': ['everyone'],
            'channel-2': ['everyone'],
            'draft:channel-3': ['everyone'],
          },
          deletedChannelIds: [],
          originalChannelIds: ['channel-1', 'channel-2'],
        },
      ),
    ).toEqual([opsTextChannel, createdTextChannel, textChannel]);
  });

  it('ignores deleted channels when ordering saved channels', () => {
    expect(
      ManagedCommunityChannels.orderSavedChannels(
        [opsTextChannel],
        {
          channelDrafts: { 'channel-1': 'general', 'channel-2': 'ops' },
          channelOrder: [textChannel, opsTextChannel],
          channelPermissionDrafts: {
            'channel-1': ['everyone'],
            'channel-2': ['everyone'],
          },
          deletedChannelIds: ['channel-1'],
          originalChannelIds: ['channel-1', 'channel-2'],
        },
      ),
    ).toEqual([opsTextChannel]);
  });
});
