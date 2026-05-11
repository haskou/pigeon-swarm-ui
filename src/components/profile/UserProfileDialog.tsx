import { useState } from 'react';
import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type { IdentityResource } from '../../domain/types';

import { copy } from '../../i18n/en';
import { shortId } from '../../utils/formatting';
import { identityPicture } from '../../utils/identityDisplay';

interface UserProfileDialogProps {
  identity?: IdentityResource;
  identityId: string;
  name: string;
  nodeNetworks: NodeNetwork[];
  onClose: () => void;
  picture?: string | null;
}

export function UserProfileDialog({
  identity,
  identityId,
  name,
  nodeNetworks,
  onClose,
  picture,
}: UserProfileDialogProps) {
  const [copied, setCopied] = useState(false);
  const profileName = identity?.profile.name.trim();
  const profileHandle = identity?.profile.handle?.trim();
  const displayName = profileName || (profileHandle ? `@${profileHandle}` : name);
  const displayHandle = profileHandle ? `@${profileHandle}` : shortId(identityId);
  const displayPicture = (identity ? identityPicture(identity) : null) ?? picture;
  const biography =
    identity?.profile.biography?.trim() || copy.profile.noBiography;
  const networks = identity?.networks ?? [];
  const networkNames = networks.map(
    (networkId) =>
      nodeNetworks.find((network) => network.id === networkId)?.name ??
      shortId(networkId),
  );

  const copyIdentityId = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(identityId);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] p-5 shadow-2xl shadow-black/40">
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
              <p className="truncate text-sm text-white/45">{displayHandle}</p>
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

        <p className="mt-1 max-h-32 overflow-y-auto rounded-3xl p-4 text-sm leading-6 text-white/70">
          {biography}
        </p>

        <div className="mt-2 grid gap-3 text-xs">
          <div className="min-w-0">
            <div className="mb-1 font-black uppercase tracking-[0.16em] text-white/35">
              {copy.profile.identityId}
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-black/25 p-2">
              <span className="block min-w-0 flex-1 truncate text-white/70">
                {identityId}
              </span>
              <button
                type="button"
                onClick={copyIdentityId}
                className="shrink-0 rounded-xl bg-white px-2.5 py-1.5 font-black text-slate-950"
              >
                {copied ? copy.profile.copied : copy.profile.copy}
              </button>
            </div>
          </div>
          <ProfileField
            label={copy.profile.networks}
            value={
              networkNames.length > 0
                ? networkNames.join(', ')
                : copy.profile.noNetworks
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
    <div className="min-w-0">
      <div className="mb-1 font-black uppercase tracking-[0.16em] text-white/35">
        {label}
      </div>
      <div className="min-w-0 break-words rounded-2xl bg-black/25 px-3 py-2 text-white/70">
        {value}
      </div>
    </div>
  );
}
