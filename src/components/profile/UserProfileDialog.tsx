import { createPortal } from 'react-dom';

import type { IdentityResource } from '../../domain/types';

import { copy } from '../../i18n/en';
import { shortId } from '../../utils/formatting';
import { identityName, identityPicture } from '../../utils/identityDisplay';

interface UserProfileDialogProps {
  identity?: IdentityResource;
  identityId: string;
  name: string;
  onClose: () => void;
  picture?: string | null;
}

export function UserProfileDialog({
  identity,
  identityId,
  name,
  onClose,
  picture,
}: UserProfileDialogProps) {
  const displayName = identity ? (identityName(identity) ?? name) : name;
  const displayPicture = identity ? identityPicture(identity) : picture;
  const biography = identity?.profile.biography?.trim();
  const networks = identity?.networks ?? [];

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 w-full max-w-md rounded-[2rem] p-5 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-2xl font-black text-slate-950">
              {displayPicture ? (
                <img
                  src={displayPicture}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black">{displayName}</h2>
              <p className="truncate text-sm text-white/45">
                {shortId(identityId)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        </div>

        {biography && (
          <p className="mt-5 rounded-3xl bg-black/25 p-4 text-sm leading-6 text-white/70">
            {biography}
          </p>
        )}

        <div className="mt-5 grid gap-3 text-xs">
          <ProfileField label={copy.profile.identityId} value={identityId} />
          <ProfileField
            label={copy.profile.networks}
            value={
              networks.length > 0 ? networks.map(shortId).join(', ') : copy.profile.noNetworks
            }
          />
        </div>
      </section>
    </div>,
    document.body,
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 font-black uppercase tracking-[0.16em] text-white/35">
        {label}
      </div>
      <div className="break-words rounded-2xl bg-black/25 px-3 py-2 text-white/70">
        {value}
      </div>
    </div>
  );
}
