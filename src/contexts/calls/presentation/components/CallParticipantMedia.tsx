import { useEffect, useState } from 'react';
import type { CallParticipant } from '../view-models/CallParticipant';

import { identityPicture } from '../../../identities/presentation/view-models/identityDisplay';
import { FallbackImage } from '../../../../shared/presentation/components/FallbackImage';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { callParticipantHasActiveScreenShare } from './callParticipantHasActiveScreenShare';
import { VideoPreview } from './VideoPreview';

export function CallParticipantMedia({
  isCurrentIdentity,
  name,
  onExpandScreen,
  participant,
  preferScreenPreview,
  variant,
}: {
  isCurrentIdentity: boolean;
  name: string;
  onExpandScreen?: (participant: CallParticipant) => void;
  participant: CallParticipant;
  preferScreenPreview: boolean;
  variant: 'grid' | 'strip';
}) {
  const mediaStream = participant.mediaStream;
  const picture =
    participant.picture ?? participantIdentityPicture(participant);
  const videoVisible = Boolean(participant.videoEnabled && mediaStream);
  const screenVisible = callParticipantHasActiveScreenShare(participant);
  const canExpandScreen = preferScreenPreview && screenVisible;
  const previewStream =
    preferScreenPreview && screenVisible && participant.screenStream
      ? participant.screenStream
      : videoVisible && mediaStream
        ? mediaStream
        : null;
  const [previewAspectRatio, setPreviewAspectRatio] = useState<number | null>(
    null,
  );

  useEffect(() => {
    setPreviewAspectRatio(null);
  }, [previewStream]);

  const media = (
    <div
      className={cx(
        'relative mt-1 grid shrink-0 place-items-center overflow-hidden rounded-xl sm:mt-3 sm:rounded-2xl',
        variant === 'strip'
          ? videoVisible
            ? 'w-full bg-black'
            : 'h-12 w-12 bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-xl font-black text-slate-950 sm:h-16 sm:w-16 sm:text-2xl'
          : videoVisible || (preferScreenPreview && screenVisible)
            ? 'w-full bg-black'
            : 'h-20 w-20 bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-3xl font-black text-slate-950 sm:h-24 sm:w-24',
      )}
      style={
        previewStream
          ? { aspectRatio: previewAspectRatio ?? 16 / 9 }
          : undefined
      }
    >
      {preferScreenPreview && screenVisible && participant.screenStream ? (
        <VideoPreview
          fit="contain"
          label={name}
          muted={isCurrentIdentity}
          onAspectRatioChange={setPreviewAspectRatio}
          stream={participant.screenStream}
        />
      ) : videoVisible && mediaStream ? (
        <VideoPreview
          fit="contain"
          label={name}
          muted={isCurrentIdentity}
          onAspectRatioChange={setPreviewAspectRatio}
          stream={mediaStream}
        />
      ) : (
        <FallbackImage
          src={picture}
          alt=""
          className="h-full w-full object-cover"
          fallback={name.slice(0, 1).toUpperCase()}
        />
      )}
      {screenVisible && !preferScreenPreview && (
        <span className="absolute right-2 top-2 rounded-full bg-emerald-400 px-2 py-0.5 text-[0.55rem] font-black text-slate-950">
          {copy.calls.live}
        </span>
      )}
      {screenVisible && preferScreenPreview && (
        <span className="absolute right-3 top-3 rounded-full bg-emerald-400 px-2 py-0.5 text-[0.6rem] font-black text-slate-950">
          {copy.calls.screen}
        </span>
      )}
    </div>
  );

  if (!canExpandScreen || !onExpandScreen) return media;

  return (
    <button
      type="button"
      onClick={() => onExpandScreen(participant)}
      className="w-full"
      title={copy.calls.screen}
    >
      {media}
    </button>
  );
}

function participantIdentityPicture(
  participant: CallParticipant,
): string | null {
  return participant.identity ? identityPicture(participant.identity) : null;
}
