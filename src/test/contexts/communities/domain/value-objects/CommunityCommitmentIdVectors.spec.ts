import { CommitmentId } from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/commitment-ids.json';

import type { MlsRecordInput } from '../../../../../contexts/communities/infrastructure/http/MlsRecordInput';

import { CommunityChannelId } from '../../../../../contexts/communities/domain/value-objects/CommunityChannelId';
import { CommunityRoleId } from '../../../../../contexts/communities/domain/value-objects/CommunityRoleId';

// The vectors ship with @haskou/pigeon-swarm-crypto; the node runs the same.
describe('community commitment id vectors', () => {
  it.each(vectors.communityChannel.valid)(
    'derives the channel id of $name',
    ({ args, id }) => {
      const [communityId, creator, createdAt] = args as [
        string,
        string,
        number,
      ];

      expect(
        CommunityChannelId.derive(communityId, creator, createdAt).valueOf(),
      ).toBe(id);
    },
  );

  it.each(vectors.communityChannel.invalid)(
    'refuses the channel id of $name',
    ({ args }) => {
      const [communityId, creator, createdAt] = args as [
        string,
        string,
        number,
      ];

      expect(() =>
        CommunityChannelId.derive(communityId, creator, createdAt),
      ).toThrow();
    },
  );

  it.each(vectors.communityRole.valid)(
    'derives the role id of $name',
    ({ args, id }) => {
      const [communityId, creator, createdAt] = args as [
        string,
        string,
        number,
      ];

      expect(
        CommunityRoleId.derive(communityId, creator, createdAt).valueOf(),
      ).toBe(id);
    },
  );

  it.each(vectors.communityRole.invalid)(
    'refuses the role id of $name',
    ({ args }) => {
      const [communityId, creator, createdAt] = args as [
        string,
        string,
        number,
      ];

      expect(() =>
        CommunityRoleId.derive(communityId, creator, createdAt),
      ).toThrow();
    },
  );

  it.each(vectors.community.valid)(
    'derives the community id of $name',
    ({ args, id }) => {
      const [networkId, owner, nonce] = args as [string, string, string];

      expect(CommitmentId.community(networkId, owner, nonce)).toBe(id);
    },
  );

  it.each(vectors.communityRequest.valid)(
    'derives the membership request id of $name',
    ({ args, id }) => {
      const [communityId, type, creator, identityId, createdAt] = args as [
        string,
        'invitation' | 'request',
        string,
        string,
        number,
      ];

      expect(
        CommitmentId.communityRequest(
          communityId,
          type,
          creator,
          identityId,
          createdAt,
        ),
      ).toBe(id);
    },
  );

  it.each(vectors.communityModerationLog.valid)(
    'derives the moderation log id of $name',
    ({ args, id }) => {
      const [communityId, actor, action, targetType, targetId, createdAt] =
        args as [string, string, string, string, string, number];

      expect(
        CommitmentId.communityModerationLog(
          communityId,
          actor,
          action,
          targetType,
          targetId,
          createdAt,
        ),
      ).toBe(id);
    },
  );

  it.each(vectors.mlsRecord.valid)(
    'derives the MLS record id of $name',
    ({ args, id }) => {
      expect(CommitmentId.mlsRecord(args[0] as MlsRecordInput)).toBe(id);
    },
  );
});
