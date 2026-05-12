import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type { ConversationResource, IdentityResource } from '../../domain/types';

import { copy } from '../../i18n/en';
import { shortId } from '../../utils/formatting';

type GroupParticipant = {
  identity?: IdentityResource;
  identityId: string;
  name: string;
  picture?: null | string;
};

interface GroupProfileDialogProps {
  conversation: ConversationResource;
  networkId?: string;
  nodeNetworks: NodeNetwork[];
  onClose: () => void;
  onIdentityClick: (participant: GroupParticipant) => void;
  participants: GroupParticipant[];
}

export function GroupProfileDialog({
  conversation,
  networkId,
  nodeNetworks,
  onClose,
  onIdentityClick,
  participants,
}: GroupProfileDialogProps) {
  const groupName = conversation.name ?? conversation.title ?? conversation.id;
  const networkName = networkId
    ? (nodeNetworks.find((network) => network.id === networkId)?.name ??
      shortId(networkId))
    : copy.profile.noNetworks;

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
              {groupName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black">{groupName}</h2>
              <p className="truncate text-sm text-white/45">
                {participants.length} {copy.sidebar.members}
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

        <div className="mt-4 min-w-0">
          <div className="mb-1 font-black uppercase tracking-[0.16em] text-white/35">
            {copy.dialog.sharedNetwork}
          </div>
          <div className="min-w-0 rounded-2xl bg-black/25 px-3 py-2 text-xs text-white/70">
            <span className="block truncate" title={networkId}>
              {networkName}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 font-black uppercase tracking-[0.16em] text-white/35">
            {copy.dialog.groupParticipants}
          </div>
          <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
            {participants.map((participant) => (
              <button
                key={participant.identityId}
                type="button"
                onClick={() => onIdentityClick(participant)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-3 text-left transition hover:bg-white/10"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
                  {participant.picture ? (
                    <img
                      src={participant.picture}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    participant.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-black">
                    {participant.name}
                  </div>
                  <div className="truncate text-xs text-white/45">
                    {participant.identity?.profile.handle
                      ? `@${participant.identity.profile.handle}`
                      : shortId(participant.identityId)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
