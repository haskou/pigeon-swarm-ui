import { PushNotificationServer } from '../../../../contexts/notifications/domain/PushNotificationServer';

describe(PushNotificationServer.name, () => {
  it('only enables delivery when a public key is available', () => {
    expect(
      PushNotificationServer.fromPrimitives({
        enabled: true,
        publicKey: 'public-key',
      }).canDeliver(),
    ).toBe(true);
    expect(
      PushNotificationServer.fromPrimitives({
        enabled: true,
        publicKey: undefined,
      }).canDeliver(),
    ).toBe(false);
  });
});
