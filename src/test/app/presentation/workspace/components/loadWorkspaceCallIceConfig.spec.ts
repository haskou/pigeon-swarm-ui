import { loadWorkspaceCallIceConfig } from '../../../../../app/presentation/workspace/components/loadWorkspaceCallIceConfig';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';
import { copy } from '../../../../../shared/presentation/i18n/copy';

describe('loadWorkspaceCallIceConfig', () => {
  afterEach(() => jest.restoreAllMocks());

  it('discards credential response bodies without writing to the console', async () => {
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const responseError = new HttpJsonError(
      502,
      'Bad Gateway',
      JSON.stringify({
        credential: 'private-turn-password',
        username: 'private-identity',
      }),
    );

    await expect(
      loadWorkspaceCallIceConfig(() => Promise.reject(responseError)),
    ).rejects.toThrow(copy.calls.iceServersUnavailable);

    expect(log).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-');
  });

  it('loads fresh configuration on each request', async () => {
    const first = { iceServers: [], iceTransportPolicy: 'relay' as const };
    const second = {
      iceServers: [{ credential: 'fresh', urls: 'turn:relay.example' }],
      iceTransportPolicy: 'relay' as const,
    };
    const load = jest
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    await expect(loadWorkspaceCallIceConfig(load)).resolves.toBe(first);
    await expect(loadWorkspaceCallIceConfig(load)).resolves.toBe(second);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
