import { useEffect, useMemo, useRef, useState } from 'react';

import type { CallParticipant, CallSession } from '../../domain/calls/CallSession';

import { LocalMediaManager } from '../../infrastructure/media/LocalMediaManager';

type StartCallInput = {
  id: string;
  communityId?: string;
  channelId?: string;
  conversationId?: string;
  kind: CallSession['kind'];
  participants: CallParticipant[];
  title: string;
};

export function useCallSession(): {
  activeCall: CallSession | null;
  endCall: () => void;
  startCall: (input: StartCallInput) => Promise<void>;
  toggleDeafen: () => void;
  toggleMute: () => void;
} {
  const mediaManager = useMemo(() => new LocalMediaManager(), []);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const activeCallRef = useRef<CallSession | null>(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(
    () => () => {
      mediaManager.stop();
    },
    [mediaManager],
  );

  const startCall = async (input: StartCallInput) => {
    const nextCall: CallSession = {
      ...input,
      deafened: false,
      muted: false,
      startedAt: Date.now(),
      status: 'connecting',
    };

    setActiveCall(nextCall);

    try {
      await mediaManager.startAudio();
      setActiveCall((current) =>
        current?.id === nextCall.id ? { ...current, status: 'live' } : current,
      );
    } catch {
      setActiveCall((current) =>
        current?.id === nextCall.id
          ? { ...current, status: 'permission-denied', muted: true }
          : current,
      );
    }
  };

  const endCall = () => {
    mediaManager.stop();
    setActiveCall(null);
  };

  const toggleMute = () => {
    setActiveCall((current) => {
      if (!current) return current;

      const muted = !current.muted;

      mediaManager.setMicrophoneMuted(muted);

      return {
        ...current,
        muted,
        participants: current.participants.map((participant, index) =>
          index === 0 ? { ...participant, muted } : participant,
        ),
      };
    });
  };

  const toggleDeafen = () => {
    setActiveCall((current) =>
      current ? { ...current, deafened: !current.deafened } : current,
    );
  };

  return {
    activeCall,
    endCall,
    startCall,
    toggleDeafen,
    toggleMute,
  };
}
