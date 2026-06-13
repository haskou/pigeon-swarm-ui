import type { LoginResult } from '../../shared/domain/pigeonResources.types';

import { RealtimeGateway } from '../../shared/infrastructure/realtime/RealtimeGateway';
import { PigeonApiGateway } from './PigeonApiGateway';
import { PigeonApplication } from './PigeonApplication';

function gatewayDouble(): PigeonApiGateway & {
  register: jest.Mock<
    Promise<LoginResult>,
    [
      string,
      string,
      string[],
      string | undefined,
      { passkeyPrfEnabled?: boolean } | undefined,
    ]
  >;
} {
  return {
    register: jest.fn().mockResolvedValue({
      conversations: [],
      session: { identity: { id: 'identity-1' } },
    } as unknown as LoginResult),
  } as unknown as PigeonApiGateway & {
    register: jest.Mock<
      Promise<LoginResult>,
      [
        string,
        string,
        string[],
        string | undefined,
        { passkeyPrfEnabled?: boolean } | undefined,
      ]
    >;
  };
}

describe(PigeonApplication.name, () => {
  it('passes passkey PRF registration options to the gateway', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonApplication(
      gateway,
      {} as unknown as RealtimeGateway,
    );

    await application.register(
      'Ada Lovelace',
      'secret-password',
      ['network-1'],
      'ada',
      {
        passkeyPrfEnabled: true,
      },
    );

    expect(gateway.register).toHaveBeenCalledWith(
      'Ada Lovelace',
      'secret-password',
      ['network-1'],
      'ada',
      { passkeyPrfEnabled: true },
    );
  });
});
