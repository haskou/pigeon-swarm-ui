import { mock } from 'jest-mock-extended';

import type { PigeonCommunityOperationsApi } from '../../../../contexts/communities/infrastructure/http/PigeonCommunityOperationsApi';
import type { PigeonMlsRecordsApi } from '../../../../contexts/communities/infrastructure/http/PigeonMlsRecordsApi';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { PigeonMlsFacade } from '../../../../app/composition/mls/PigeonMlsFacade';
import { MlsCommunityEngine } from '../../../../contexts/communities/infrastructure/mls/MlsCommunityEngine';
import { CommunityOperationHistory } from '../../../contexts/communities/infrastructure/http/CommunityOperationHistory';
import { MlsTestIdentity } from '../../../contexts/communities/infrastructure/mls/MlsTestIdentity';

describe('PigeonMlsFacade', () => {
  let cast: Record<string, MlsTestIdentity>;
  let history: CommunityOperationHistory;
  let open: string;
  let restricted: string;
  let facade: PigeonMlsFacade;
  let session: Session;

  beforeAll(async () => {
    cast = await MlsTestIdentity.cast(['owner', 'member']);
  });

  beforeEach(() => {
    const { member, owner } = cast;
    const operations = mock<PigeonCommunityOperationsApi>();

    history = new CommunityOperationHistory(owner);
    history.add(owner, member);
    open = history.createChannel(owner);
    restricted = history.createChannel(owner);
    history.restrictChannel(owner, restricted, [history.createRole(owner, [])]);
    operations.list.mockImplementation(() =>
      Promise.resolve(history.operations()),
    );
    facade = new PigeonMlsFacade(mock<PigeonMlsRecordsApi>(), operations);
    session = {
      deviceCredentialKeyPair: owner.deviceKeyPair(),
      identity: { id: owner.id },
    } as unknown as Session;
    jest
      .spyOn(MlsCommunityEngine.prototype, 'callMediaKey')
      .mockResolvedValue(new Uint8Array(32));
    jest
      .spyOn(MlsCommunityEngine.prototype, 'encrypt')
      .mockResolvedValue('sealed');
  });

  afterEach(() => jest.restoreAllMocks());

  const groupsSealedFor = async (channelId: string): Promise<string[]> => {
    await facade.callMediaKey(session, history.communityId, channelId, 'call');
    await facade.encrypt(session, history.communityId, channelId, 'text');

    return [
      jest.mocked(MlsCommunityEngine.prototype.callMediaKey).mock.calls[0][0],
      jest.mocked(MlsCommunityEngine.prototype.encrypt).mock.calls[0][0],
    ];
  };

  it('seals a restricted channel for its own group', async () => {
    expect(await groupsSealedFor(restricted)).toEqual([
      `${history.communityId}:${restricted}`,
      `${history.communityId}:${restricted}`,
    ]);
  });

  it('seals a channel everyone may see for the community group', async () => {
    expect(await groupsSealedFor(open)).toEqual([
      history.communityId,
      history.communityId,
    ]);
  });

  it('keeps a channel the signed history does not show on the community group', async () => {
    expect(await groupsSealedFor('legacy-channel')).toEqual([
      history.communityId,
      history.communityId,
    ]);
  });

  it('opens the channel back on the community group once everyone may see it', async () => {
    history.restrictChannel(cast.owner, restricted, []);

    expect(await groupsSealedFor(restricted)).toEqual([
      history.communityId,
      history.communityId,
    ]);
  });
});
