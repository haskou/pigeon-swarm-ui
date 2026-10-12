import { PrivateBlobReplicaPlanner } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobReplicaPlanner';

describe(PrivateBlobReplicaPlanner.name, () => {
  const senderHome = 'https://node-a.example';
  const recipientHome = 'https://node-b.example';

  const planner = (
    overrides: {
      home?: () => string | undefined;
      verifiedRecipientHome?: (
        identityId: string,
      ) => Promise<string | undefined>;
    } = {},
  ) =>
    new PrivateBlobReplicaPlanner({
      home: () => senderHome,
      verifiedRecipientHome: () => Promise.resolve(recipientHome),
      ...overrides,
    });

  it('plans only the sender home when there is no recipient', async () => {
    const verifiedRecipientHome = jest.fn();

    await expect(
      planner({ verifiedRecipientHome }).plan(undefined),
    ).resolves.toEqual([senderHome]);
    expect(verifiedRecipientHome).not.toHaveBeenCalled();
  });

  it('adds the verified recipient home after the sender home', async () => {
    await expect(planner().plan('recipient-1')).resolves.toEqual([
      senderHome,
      recipientHome,
    ]);
  });

  it('drops a recipient home that equals the sender home', async () => {
    await expect(
      planner({
        verifiedRecipientHome: () => Promise.resolve(senderHome),
      }).plan('recipient-1'),
    ).resolves.toEqual([senderHome]);
  });

  it('keeps the sender home when the recipient home is unverified or cannot be resolved', async () => {
    await expect(
      planner({
        verifiedRecipientHome: () => Promise.resolve(undefined),
      }).plan('recipient-1'),
    ).resolves.toEqual([senderHome]);
    await expect(
      planner({
        verifiedRecipientHome: () => Promise.reject(new Error('offline')),
      }).plan('recipient-1'),
    ).resolves.toEqual([senderHome]);
  });

  it('never plans an origin that fails the canonical rule', async () => {
    await expect(
      planner({
        home: () => 'http://plain.example',
        verifiedRecipientHome: () => Promise.resolve('https://node-b.example/'),
      }).plan('recipient-1'),
    ).resolves.toEqual([]);
  });

  it('drops an invalid sender home but still plans a valid recipient home', async () => {
    await expect(
      planner({ home: () => 'http://plain.example' }).plan('recipient-1'),
    ).resolves.toEqual([recipientHome]);
  });
});
