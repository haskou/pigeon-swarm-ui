import { expect, test } from '@playwright/test';

test('rejoins with current ICE after delayed candidates from the previous call', async ({
  page,
}) => {
  await page.route('**/rtc-regression', (route) =>
    route.fulfill({
      body: '<!doctype html><html><body></body></html>',
      contentType: 'text/html',
    }),
  );
  await page.goto('/rtc-regression');

  const result = await page.evaluate(async () => {
    const moduleRoot = '/src/contexts/calls/infrastructure/media/';
    const { CallPeerConnections } = (await import(
      `${moduleRoot}CallPeerConnections.ts`
    )) as typeof import('../src/contexts/calls/infrastructure/media/CallPeerConnections');
    const { RemoteCallAudio } = (await import(
      `${moduleRoot}RemoteCallAudio.ts`
    )) as typeof import('../src/contexts/calls/infrastructure/media/RemoteCallAudio');
    const manager = new CallPeerConnections(
      new RemoteCallAudio({
        create: () => document.createElement('audio'),
        mount: (element) => {
          document.body.append(element);
        },
      }),
    );
    const remotes: RTCPeerConnection[] = [];
    const signals: { type: string; payload: Record<string, unknown> }[] = [];
    const sendSignal = async (
      _identity: string,
      type: string,
      payload: Record<string, unknown>,
    ): Promise<void> => {
      signals.push({ type, payload });
    };
    const waitFor = async (
      predicate: () => boolean | Promise<boolean>,
      stage: string,
    ): Promise<void> => {
      const deadline = Date.now() + 15_000;

      while (Date.now() < deadline) {
        if (await predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(`Timed out during ${stage}`);
    };
    const createRemoteAnswer = async (): Promise<{
      answer: RTCSessionDescriptionInit;
      candidates: RTCIceCandidateInit[];
      remote: RTCPeerConnection;
    }> => {
      await manager.ensurePeer('remote', true, sendSignal);
      const offer = signals.find((signal) => signal.type === 'offer');

      if (!offer) throw new Error('The application did not send an offer');
      const remote = new RTCPeerConnection({ iceServers: [] });
      const candidates: RTCIceCandidateInit[] = [];

      remotes.push(remote);
      remote.addEventListener('icecandidate', ({ candidate }) => {
        if (candidate) candidates.push(candidate.toJSON());
      });
      await remote.setRemoteDescription(
        offer.payload as RTCSessionDescriptionInit,
      );
      await remote.setLocalDescription(await remote.createAnswer());
      await waitFor(
        () => remote.iceGatheringState === 'complete',
        'remote ICE gathering',
      );
      await waitFor(
        () => signals.some((signal) => signal.type === 'ice_candidate'),
        'application ICE gathering',
      );

      for (const signal of signals.filter(
        (signal) => signal.type === 'ice_candidate',
      ))
        await remote.addIceCandidate(signal.payload as RTCIceCandidateInit);

      if (!candidates.length)
        throw new Error('Chromium did not produce remote candidates');

      return {
        answer: {
          sdp: remote
            .localDescription!.sdp.split('\r\n')
            .filter(
              (line) =>
                !line.startsWith('a=candidate:') &&
                line !== 'a=end-of-candidates',
            )
            .join('\r\n'),
          type: 'answer',
        },
        candidates,
        remote,
      };
    };
    const deliverCandidate = async (
      candidate: RTCIceCandidateInit,
    ): Promise<void> => {
      await manager.handleSignal(
        'remote',
        'ice_candidate',
        candidate as Record<string, unknown>,
        sendSignal,
        'local',
      );
    };
    const deliverAnswer = async (
      answer: RTCSessionDescriptionInit,
    ): Promise<void> => {
      await manager.handleSignal(
        'remote',
        'answer',
        answer as Record<string, unknown>,
        sendSignal,
        'local',
      );
    };

    try {
      manager.configure(async () => ({ iceServers: [] }));
      const previous = await createRemoteAnswer();

      await deliverAnswer(previous.answer);
      for (const candidate of previous.candidates)
        await deliverCandidate(candidate);
      await waitFor(
        () => previous.remote.connectionState === 'connected',
        'initial connection',
      );
      manager.reset();
      previous.remote.close();
      signals.length = 0;
      manager.configure(async () => ({ iceServers: [] }));
      await deliverCandidate(previous.candidates[0]);
      await deliverAnswer(previous.answer);
      await deliverCandidate(previous.candidates[0]);
      const current = await createRemoteAnswer();

      if (
        current.candidates[0].usernameFragment ===
        previous.candidates[0].usernameFragment
      )
        throw new Error(
          'The two real peers must use different ICE generations',
        );
      for (const candidate of current.candidates)
        await deliverCandidate(candidate);
      await deliverAnswer(current.answer);
      await waitFor(
        () => current.remote.connectionState === 'connected',
        'rejoined connection',
      );
      const stats = await manager.collectStats();

      return {
        connection: stats.remote.connectionState,
        remoteConnection: current.remote.connectionState,
      };
    } finally {
      manager.reset();
      for (const remote of remotes) remote.close();
    }
  });

  expect(result).toEqual({
    connection: 'connected',
    remoteConnection: 'connected',
  });
});
