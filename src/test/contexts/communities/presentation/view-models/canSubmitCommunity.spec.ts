import { canSubmitCommunity } from '../../../../../contexts/communities/presentation/view-models/canSubmitCommunity';

const readyPrivate = {
  busy: false,
  channelsValid: true,
  hasName: true,
  hasNetwork: true,
  networksFailed: false,
  networksLoading: false,
  visibility: 'private' as const,
};

describe(canSubmitCommunity.name, () => {
  it('allows a private community once a private network is chosen and loaded', () => {
    expect(canSubmitCommunity(readyPrivate)).toBe(true);
  });

  it('blocks a private community while the node network list is loading or failed', () => {
    expect(canSubmitCommunity({ ...readyPrivate, networksLoading: true })).toBe(
      false,
    );
    expect(canSubmitCommunity({ ...readyPrivate, networksFailed: true })).toBe(
      false,
    );
  });

  it('keeps public communities allowed on any network while the node list loads or fails', () => {
    expect(
      canSubmitCommunity({
        ...readyPrivate,
        networksLoading: true,
        visibility: 'public',
      }),
    ).toBe(true);
    expect(
      canSubmitCommunity({
        ...readyPrivate,
        networksFailed: true,
        visibility: 'public',
      }),
    ).toBe(true);
  });

  it('blocks without a network, a name, valid channels, or while busy', () => {
    expect(canSubmitCommunity({ ...readyPrivate, hasNetwork: false })).toBe(
      false,
    );
    expect(canSubmitCommunity({ ...readyPrivate, hasName: false })).toBe(false);
    expect(canSubmitCommunity({ ...readyPrivate, channelsValid: false })).toBe(
      false,
    );
    expect(canSubmitCommunity({ ...readyPrivate, busy: true })).toBe(false);
  });
});
