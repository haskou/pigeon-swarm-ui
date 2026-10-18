import { CallPeerRecovery } from '../../../../../contexts/calls/infrastructure/media/CallPeerRecovery';

function peerConnection(
  connectionState: RTCPeerConnectionState,
  iceConnectionState: RTCIceConnectionState,
): RTCPeerConnection {
  return {
    connectionState,
    iceConnectionState,
    restartIce: jest.fn(),
  } as unknown as RTCPeerConnection;
}

function negotiated(peer: RTCPeerConnection): RTCPeerConnection {
  return Object.assign(peer, {
    localDescription: { type: 'offer' },
    remoteDescription: { type: 'answer' },
  });
}

function noReplacement(): Promise<void> {
  return Promise.resolve();
}

describe('CallPeerRecovery', () => {
  afterEach(() => jest.useRealTimers());

  it.each(['new', 'checking'] as const)(
    'keeps initial %s negotiation distinct from an actual recovery attempt',
    async (iceState) => {
      jest.useFakeTimers();
      const peer = peerConnection('new', iceState);
      Object.assign(peer, {
        localDescription: { type: 'offer' },
        remoteDescription: { type: 'answer' },
      });
      const recovery = new CallPeerRecovery(
        () => Promise.resolve(),
        noReplacement,
      );
      recovery.reconcile('peer', peer, () => true);
      expect(recovery.stateFor('peer')).toBe('idle');
      await jest.advanceTimersByTimeAsync(14_999);
      expect(recovery.stateFor('peer')).toBe('idle');
      await jest.advanceTimersByTimeAsync(1);
      expect(recovery.stateFor('peer')).toBe('recovering');
      recovery.reset();
    },
  );

  it('bounds an offer the remote peer never answers like a negotiation that never connects', async () => {
    jest.useFakeTimers();
    const restart = jest.fn(() => Promise.resolve());
    const recovery = new CallPeerRecovery(restart, noReplacement);
    const peer = peerConnection('new', 'new');
    Object.assign(peer, {
      localDescription: { type: 'offer' },
      remoteDescription: null,
      signalingState: 'have-local-offer',
    });
    recovery.reconcile('peer', peer, () => true);
    await jest.advanceTimersByTimeAsync(14_999);
    expect(restart).not.toHaveBeenCalled();
    expect(recovery.stateFor('peer')).toBe('idle');
    await jest.advanceTimersByTimeAsync(1);
    expect(restart).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(45_000);
    expect(restart).toHaveBeenCalledTimes(3);
    expect(recovery.stateFor('peer')).toBe('exhausted');
    recovery.reset();
  });

  it('bounds a peer that never starts negotiating', async () => {
    jest.useFakeTimers();
    const restart = jest.fn(() => Promise.resolve());
    const recovery = new CallPeerRecovery(restart, noReplacement);
    const peer = peerConnection('new', 'new');
    Object.assign(peer, {
      localDescription: null,
      remoteDescription: null,
      signalingState: 'stable',
    });
    recovery.reconcile('peer', peer, () => true);
    await jest.advanceTimersByTimeAsync(14_999);
    expect(restart).not.toHaveBeenCalled();
    expect(recovery.stateFor('peer')).toBe('idle');
    await jest.advanceTimersByTimeAsync(1);
    expect(restart).toHaveBeenCalledTimes(1);
    expect(recovery.stateFor('peer')).toBe('recovering');
    await jest.advanceTimersByTimeAsync(45_000);
    expect(restart).toHaveBeenCalledTimes(3);
    expect(recovery.stateFor('peer')).toBe('exhausted');
  });

  it('exposes exhaustion only after the final outcome window and retries only on request', async () => {
    jest.useFakeTimers();
    const peer = peerConnection('failed', 'failed');
    const recovery = new CallPeerRecovery(
      (_peerIdentityId, current, canRestart) => {
        if (canRestart()) current.restartIce();

        return Promise.resolve();
      },
      noReplacement,
    );
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(peer.restartIce).toHaveBeenCalledTimes(3);
    expect(recovery.stateFor('peer-1')).toBe('recovering');
    await jest.advanceTimersByTimeAsync(14_999);
    expect(recovery.stateFor('peer-1')).toBe('recovering');
    await jest.advanceTimersByTimeAsync(1);
    expect(recovery.stateFor('peer-1')).toBe('exhausted');
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(peer.restartIce).toHaveBeenCalledTimes(3);
    recovery.retry('peer-1', peer, () => true);
    recovery.retry('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(0);
    expect(peer.restartIce).toHaveBeenCalledTimes(4);
    expect(recovery.stateFor('peer-1')).toBe('recovering');
    recovery.reset();
    expect(recovery.stateFor('peer-1')).toBe('idle');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears exhaustion when a late connection succeeds and refuses stale manual retries', async () => {
    jest.useFakeTimers();
    const peer = peerConnection('failed', 'failed');
    const recovery = new CallPeerRecovery(
      (_peerIdentityId, current, canRestart) => {
        if (canRestart()) current.restartIce();

        return Promise.resolve();
      },
      noReplacement,
    );
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(120_000);
    recovery.retry('peer-1', peer, () => false);
    await jest.advanceTimersByTimeAsync(0);
    expect(peer.restartIce).toHaveBeenCalledTimes(3);
    Object.assign(peer, {
      connectionState: 'connected',
      iceConnectionState: 'completed',
    });
    recovery.reconcile('peer-1', peer, () => true);
    expect(recovery.stateFor('peer-1')).toBe('idle');
    recovery.retry('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(0);
    expect(peer.restartIce).toHaveBeenCalledTimes(3);
    recovery.reset();
  });

  it('restarts ICE immediately after a failed connection', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery(
      (_peerIdentityId, peer, canRestart) => {
        if (canRestart()) peer.restartIce();

        return Promise.resolve();
      },
      noReplacement,
    );
    const peer = peerConnection('failed', 'failed');

    recovery.reconcile('peer-1', peer, () => true);
    await jest.runOnlyPendingTimersAsync();

    expect(peer.restartIce).toHaveBeenCalledTimes(1);
  });

  it('cancels pending recovery when the peer is forgotten', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery(
      (_peerIdentityId, peer, canRestart) => {
        if (canRestart()) peer.restartIce();

        return Promise.resolve();
      },
      noReplacement,
    );
    const peer = peerConnection('disconnected', 'disconnected');

    recovery.reconcile('peer-1', peer, () => true);
    recovery.forget('peer-1');
    await jest.runOnlyPendingTimersAsync();

    expect(peer.restartIce).not.toHaveBeenCalled();
  });

  it('recovers stalled checking without extending the deadline on repeated events', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery(
      (_peerIdentityId, peer, canRestart) => {
        if (canRestart()) peer.restartIce();

        return Promise.resolve();
      },
      noReplacement,
    );
    const peer = peerConnection('connecting', 'checking');

    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(10_000);
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(4_999);
    expect(peer.restartIce).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(peer.restartIce).toHaveBeenCalledTimes(1);
  });

  it('bounds recovery when checking never changes and ignores later retry events', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery(
      (_peerIdentityId, peer, canRestart) => {
        if (canRestart()) peer.restartIce();

        return Promise.resolve();
      },
      noReplacement,
    );
    const peer = peerConnection('connecting', 'checking');

    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(120_000);
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(120_000);

    expect(peer.restartIce).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['forget', 'reset', 'replaced', 'closed', 'healthy'])(
    'cancels stalled checking recovery when %s',
    async (reason) => {
      jest.useFakeTimers();
      const recovery = new CallPeerRecovery(
        (_peerIdentityId, peer, canRestart) => {
          if (canRestart()) peer.restartIce();

          return Promise.resolve();
        },
        noReplacement,
      );
      const peer = peerConnection('connecting', 'checking');
      let current = true;
      recovery.reconcile('peer-1', peer, () => current);

      if (reason === 'forget') recovery.forget('peer-1');

      if (reason === 'reset') recovery.reset();

      if (reason === 'replaced') current = false;

      if (reason === 'closed')
        Object.assign(peer, { connectionState: 'closed' });

      if (reason === 'healthy') {
        Object.assign(peer, {
          connectionState: 'connected',
          iceConnectionState: 'completed',
        });
        recovery.reconcile('peer-1', peer, () => current);
      }
      await jest.advanceTimersByTimeAsync(120_000);

      expect(peer.restartIce).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('resets the recovery budget after a healthy connection', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery(
      (_peerIdentityId, peer, canRestart) => {
        if (canRestart()) peer.restartIce();

        return Promise.resolve();
      },
      noReplacement,
    );
    const peer = peerConnection('connecting', 'checking');
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(peer.restartIce).toHaveBeenCalledTimes(3);

    Object.assign(peer, {
      connectionState: 'connected',
      iceConnectionState: 'completed',
    });
    recovery.reconcile('peer-1', peer, () => true);
    Object.assign(peer, {
      connectionState: 'connecting',
      iceConnectionState: 'checking',
    });
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(15_000);

    expect(peer.restartIce).toHaveBeenCalledTimes(4);
    recovery.reset();
  });

  it('also bounds retries when a failed connection never emits another event', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery(
      (_peerIdentityId, peer, canRestart) => {
        if (canRestart()) peer.restartIce();

        return Promise.resolve();
      },
      noReplacement,
    );
    const peer = peerConnection('failed', 'failed');
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(120_000);

    expect(peer.restartIce).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('replaces a checking deadline with immediate recovery when ICE fails', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery(
      (_peerIdentityId, peer, canRestart) => {
        if (canRestart()) peer.restartIce();

        return Promise.resolve();
      },
      noReplacement,
    );
    const peer = peerConnection('connecting', 'checking');
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(1_000);
    Object.assign(peer, {
      connectionState: 'failed',
      iceConnectionState: 'failed',
    });
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(0);

    expect(peer.restartIce).toHaveBeenCalledTimes(1);
    recovery.reset();
  });

  it('allows a restart time to negotiate before consuming the next attempt', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery(
      (_peerIdentityId, peer, canRestart) => {
        if (canRestart()) peer.restartIce();

        return Promise.resolve();
      },
      noReplacement,
    );
    const peer = peerConnection('failed', 'failed');
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(0);
    expect(peer.restartIce).toHaveBeenCalledTimes(1);
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(14_999);
    expect(peer.restartIce).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(peer.restartIce).toHaveBeenCalledTimes(2);
    recovery.reset();
  });

  it('bounds refreshes that never settle and ignores late completions', async () => {
    jest.useFakeTimers();
    const peer = peerConnection('failed', 'failed');
    const completions: (() => void)[] = [];
    const restart = jest.fn(
      (
        _peerIdentityId: string,
        currentPeer: RTCPeerConnection,
        canRestart: () => boolean,
      ) =>
        new Promise<void>((resolve) => {
          completions.push(() => {
            if (canRestart()) currentPeer.restartIce();
            resolve();
          });
        }),
    );
    const recovery = new CallPeerRecovery(restart, noReplacement);
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(120_000);

    expect(restart).toHaveBeenCalledTimes(3);
    expect(peer.restartIce).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    completions.forEach((complete) => complete());
    await jest.advanceTimersByTimeAsync(0);
    expect(peer.restartIce).not.toHaveBeenCalled();
  });

  it('does not let a cancelled refresh disturb a replacement peer', async () => {
    jest.useFakeTimers();
    const oldPeer = peerConnection('failed', 'failed');
    const newPeer = peerConnection('failed', 'failed');
    const completions: (() => void)[] = [];
    const restart = jest.fn(
      (
        _peerIdentityId: string,
        peer: RTCPeerConnection,
        canRestart: () => boolean,
      ) =>
        new Promise<void>((resolve) => {
          completions.push(() => {
            if (canRestart()) peer.restartIce();
            resolve();
          });
        }),
    );
    const recovery = new CallPeerRecovery(restart, noReplacement);
    recovery.reconcile('peer-1', oldPeer, () => true);
    await jest.advanceTimersByTimeAsync(0);
    recovery.forget('peer-1');
    recovery.reconcile('peer-1', newPeer, () => true);
    await jest.advanceTimersByTimeAsync(0);
    completions[0]();
    await jest.advanceTimersByTimeAsync(0);
    recovery.reconcile('peer-1', newPeer, () => true);
    await jest.advanceTimersByTimeAsync(0);
    expect(restart).toHaveBeenCalledTimes(2);
    completions[1]();
    await jest.advanceTimersByTimeAsync(0);

    expect(oldPeer.restartIce).not.toHaveBeenCalled();
    expect(newPeer.restartIce).toHaveBeenCalledTimes(1);
    recovery.reset();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps the restart budget when a connection is replaced', async () => {
    jest.useFakeTimers();
    const restart = jest.fn(() => Promise.resolve());
    const recovery = new CallPeerRecovery(restart, noReplacement);
    recovery.reconcile('peer', peerConnection('failed', 'failed'), () => true);
    await jest.advanceTimersByTimeAsync(0);
    expect(restart).toHaveBeenCalledTimes(1);

    recovery.detach('peer');
    recovery.reconcile('peer', peerConnection('failed', 'failed'), () => true);
    await jest.advanceTimersByTimeAsync(60_000);

    expect(restart).toHaveBeenCalledTimes(3);
    expect(recovery.stateFor('peer')).toBe('exhausted');
  });

  it('abandons a refresh in flight for a replaced connection', async () => {
    jest.useFakeTimers();
    const oldPeer = peerConnection('failed', 'failed');
    const completions: (() => void)[] = [];
    const recovery = new CallPeerRecovery(
      (_peerIdentityId, peer, canRestart) =>
        new Promise<void>((resolve) => {
          completions.push(() => {
            if (canRestart()) peer.restartIce();
            resolve();
          });
        }),
      noReplacement,
    );
    recovery.reconcile('peer', oldPeer, () => true);
    await jest.advanceTimersByTimeAsync(0);
    recovery.detach('peer');
    completions[0]();
    await jest.advanceTimersByTimeAsync(0);

    expect(oldPeer.restartIce).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    recovery.reset();
  });

  it('allows a peer only so many replacements until a connection turns healthy', () => {
    const recovery = new CallPeerRecovery(noReplacement, noReplacement);
    const allowed = Array.from({ length: 12 }, () =>
      recovery.allowReplacement('peer'),
    );

    expect(allowed.filter(Boolean)).toHaveLength(10);
    expect(recovery.stateFor('peer')).toBe('exhausted');

    recovery.reconcile(
      'peer',
      peerConnection('connected', 'connected'),
      () => true,
    );

    expect(recovery.stateFor('peer')).toBe('idle');
    expect(recovery.allowReplacement('peer')).toBe(true);
  });

  it('counts the replacements of each peer on its own and forgets them with the peer', () => {
    const recovery = new CallPeerRecovery(noReplacement, noReplacement);

    Array.from({ length: 11 }, () => recovery.allowReplacement('noisy'));

    expect(recovery.allowReplacement('quiet')).toBe(true);
    expect(recovery.stateFor('quiet')).toBe('idle');

    recovery.forget('noisy');

    expect(recovery.stateFor('noisy')).toBe('idle');
    expect(recovery.allowReplacement('noisy')).toBe(true);
  });

  it('keeps counting the replacements of a peer whose recovery is abandoned until it leaves the call', () => {
    const recovery = new CallPeerRecovery(noReplacement, noReplacement);

    Array.from({ length: 10 }, () => recovery.allowReplacement('peer'));
    recovery.abandon('peer');

    expect(recovery.allowReplacement('peer')).toBe(false);

    recovery.retain(new Set(['other']));

    expect(recovery.allowReplacement('peer')).toBe(true);
  });

  it('restarts a negotiated unhealthy peer at once after a disruption, even when recovery was exhausted', async () => {
    jest.useFakeTimers();
    const restart = jest.fn(() => Promise.resolve());
    const recovery = new CallPeerRecovery(restart, noReplacement);
    const peer = negotiated(peerConnection('failed', 'failed'));
    recovery.reconcile('peer', peer, () => true);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(recovery.stateFor('peer')).toBe('exhausted');
    expect(restart).toHaveBeenCalledTimes(3);

    recovery.disrupt('peer', peer, false, () => true);
    await jest.advanceTimersByTimeAsync(0);

    expect(restart).toHaveBeenCalledTimes(4);
    expect(recovery.stateFor('peer')).not.toBe('exhausted');
    recovery.reset();
  });

  it('spaces disruption restarts so a flapping network cannot restart a peer in a storm', async () => {
    jest.useFakeTimers();
    const restart = jest.fn(() => Promise.resolve());
    const recovery = new CallPeerRecovery(restart, noReplacement);
    const peer = negotiated(peerConnection('disconnected', 'disconnected'));
    recovery.disrupt('peer', peer, false, () => true);
    await jest.advanceTimersByTimeAsync(0);
    expect(restart).toHaveBeenCalledTimes(1);

    recovery.disrupt('peer', peer, false, () => true);
    recovery.disrupt('peer', peer, false, () => true);
    await jest.advanceTimersByTimeAsync(4_999);
    expect(restart).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    recovery.disrupt('peer', peer, false, () => true);
    await jest.advanceTimersByTimeAsync(0);
    expect(restart).toHaveBeenCalledTimes(2);
    recovery.reset();
  });

  it('lets the impolite peer drive a disruption both peers notice so their restart offers cannot collide', async () => {
    jest.useFakeTimers();
    const restart = jest.fn(() => Promise.resolve());
    const recovery = new CallPeerRecovery(restart, noReplacement);
    const answered = negotiated(peerConnection('disconnected', 'disconnected'));
    const unanswered = negotiated(
      peerConnection('disconnected', 'disconnected'),
    );
    recovery.disrupt('answered', answered, true, () => true);
    recovery.disrupt('unanswered', unanswered, true, () => true);
    await jest.advanceTimersByTimeAsync(2_999);
    expect(restart).not.toHaveBeenCalled();

    // The impolite peer's restart offer reconnects this peer meanwhile.
    Object.assign(answered, {
      connectionState: 'connected',
      iceConnectionState: 'connected',
    });
    await jest.advanceTimersByTimeAsync(1);

    expect(restart).toHaveBeenCalledTimes(1);
    expect(restart).toHaveBeenCalledWith(
      'unanswered',
      unanswered,
      expect.any(Function),
    );
    recovery.reset();
  });

  it('leaves healthy, unnegotiated, and replaced peers alone on a disruption', async () => {
    jest.useFakeTimers();
    const restart = jest.fn(() => Promise.resolve());
    const recovery = new CallPeerRecovery(restart, noReplacement);
    recovery.disrupt(
      'healthy',
      negotiated(peerConnection('connected', 'connected')),
      false,
      () => true,
    );
    recovery.disrupt(
      'waiting',
      peerConnection('new', 'new'),
      false,
      () => true,
    );
    recovery.disrupt(
      'replaced',
      negotiated(peerConnection('failed', 'failed')),
      false,
      () => false,
    );
    await jest.advanceTimersByTimeAsync(60_000);

    expect(restart).not.toHaveBeenCalled();
    expect(recovery.stateFor('healthy')).toBe('idle');
    recovery.reset();
  });

  it('replaces a peer whose ICE connected while its DTLS never finished', async () => {
    jest.useFakeTimers();
    const restart = jest.fn(() => Promise.resolve());
    const replaceConnection = jest.fn(() => Promise.resolve());
    const recovery = new CallPeerRecovery(restart, replaceConnection);
    const peer = peerConnection('connecting', 'connected');

    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(14_999);
    expect(replaceConnection).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    expect(replaceConnection).toHaveBeenCalledTimes(1);
    expect(replaceConnection).toHaveBeenCalledWith(
      'peer-1',
      expect.any(Function),
    );
    expect(restart).not.toHaveBeenCalled();
    expect(peer.restartIce).not.toHaveBeenCalled();
    recovery.reset();
  });

  it('bounds a peer stalled in DTLS like any other stalled negotiation', async () => {
    jest.useFakeTimers();
    const replaceConnection = jest.fn(() => Promise.resolve());
    const recovery = new CallPeerRecovery(noReplacement, replaceConnection);
    const peer = peerConnection('connecting', 'connected');

    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(120_000);

    expect(replaceConnection).toHaveBeenCalledTimes(3);
    expect(recovery.stateFor('peer-1')).toBe('exhausted');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('restarts ICE rather than replacing a peer still checking', async () => {
    jest.useFakeTimers();
    const replaceConnection = jest.fn(() => Promise.resolve());
    const recovery = new CallPeerRecovery(
      (_peerIdentityId, peer, canRestart) => {
        if (canRestart()) peer.restartIce();

        return Promise.resolve();
      },
      replaceConnection,
    );
    const peer = peerConnection('connecting', 'checking');

    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(15_000);

    expect(peer.restartIce).toHaveBeenCalledTimes(1);
    expect(replaceConnection).not.toHaveBeenCalled();
    recovery.reset();
  });

  it('leaves connected and closed peers alone even when their ICE connected', async () => {
    jest.useFakeTimers();
    const replaceConnection = jest.fn(() => Promise.resolve());
    const recovery = new CallPeerRecovery(noReplacement, replaceConnection);
    const connected = peerConnection('connected', 'connected');
    const closed = peerConnection('closed', 'connected');

    recovery.reconcile('connected', connected, () => true);
    recovery.reconcile('closed', closed, () => true);
    await jest.advanceTimersByTimeAsync(120_000);

    expect(replaceConnection).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
