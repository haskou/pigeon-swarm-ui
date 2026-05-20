import type { MouseEvent } from 'react';

import { useEffect, useState } from 'react';

import type {
  IdentityPresence,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { identityBanner } from '../../../identities/presentation/view-models/identityDisplay';
import { shortId } from '../../../../shared/presentation/formatting';
import { FallbackImage } from '../../../../shared/presentation/components/FallbackImage';
import { PresenceStatusDot } from '../../../identities/presentation/components/presenceStatusDot';
import { loadPublicImage } from './communityImages';
import { memberPrimaryName } from './communityMemberNames';

export function MemberRow({
  identity,
  identityId,
  name,
  onClick,
  owner = false,
  pictureUrl,
  presence,
}: {
  identity?: IdentityResource;
  identityId: string;
  name?: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  owner?: boolean;
  pictureUrl: null | string;
  presence?: IdentityPresence;
}) {
  const displayName = name ?? memberPrimaryName(identity, identityId);
  const handle = identity?.profile.handle?.trim();
  const bannerUrl = useIdentityBannerUrl(identity);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-white/8 p-3 text-left transition hover:bg-white/12"
    >
      {bannerUrl && (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(6,8,26,0) 0%, rgba(6,8,26,0) 50%, rgba(6,8,26,.62) 100%), url(${bannerUrl})`,
            maskImage:
              'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,.18) 56%, rgba(0,0,0,.55) 72%, black 100%)',
            WebkitMaskImage:
              'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,.18) 56%, rgba(0,0,0,.55) 72%, black 100%)',
          }}
        />
      )}
      <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-visible rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
        <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-2xl">
          <FallbackImage
            src={pictureUrl}
            alt=""
            className="h-full w-full object-cover"
            fallback={displayName.slice(0, 1).toUpperCase()}
          />
        </span>
        <PresenceStatusDot presence={presence} className="-bottom-1 -right-1" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="truncate text-sm font-black">{displayName}</div>
        <div className="truncate text-xs text-white/45">
          {handle ? `@${handle}` : shortId(identityId)}
        </div>
      </div>
      {owner && (
        <span
          className="absolute right-2 top-2 text-sm text-yellow-300"
          title={copy.communities.owner}
        >
          ♛
        </span>
      )}
    </button>
  );
}

function useIdentityBannerUrl(identity?: IdentityResource): string | null {
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!identity?.profile.banner) {
      setBannerUrl(null);

      return;
    }

    const directBanner = identityBanner(identity);

    if (directBanner) {
      setBannerUrl(directBanner);

      return;
    }

    let cancelled = false;
    const bannerCid = identity.profile.banner.trim();

    setBannerUrl(null);
    void loadPublicImage(bannerCid)
      .then((loadedBanner) => {
        if (!cancelled) setBannerUrl(loadedBanner);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [identity]);

  return bannerUrl;
}
