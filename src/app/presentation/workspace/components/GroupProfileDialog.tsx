import type { MouseEvent } from 'react';

import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../../../modules/networks/application/list-node-networks/ListNodeNetworks';
import type {
  ConversationResource,
  IdentityPresence,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { shortId } from '../../../../shared/presentation/formatting';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { MemberRow } from '../../../../modules/communities/presentation/components/MemberRow';

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
  onIdentityClick: (
    participant: GroupParticipant,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  participants: GroupParticipant[];
  presenceByIdentityId?: Record<string, IdentityPresence>;
}

export function GroupProfileDialog({
  conversation,
  networkId,
  nodeNetworks,
  onClose,
  onIdentityClick,
  participants,
  presenceByIdentityId = {},
}: GroupProfileDialogProps) {
  useCloseOnEscape(onClose);

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
      <section className="glass-panel-strong relative z-10 w-full max-w-md overflow-hidden rounded-2xl p-5 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-2xl font-black text-slate-950">
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
              <MemberRow
                key={participant.identityId}
                identity={participant.identity}
                identityId={participant.identityId}
                name={participant.name}
                onClick={(event) => onIdentityClick(participant, event)}
                pictureUrl={participant.picture ?? null}
                presence={presenceByIdentityId[participant.identityId]}
                showBanner={false}
              />
            ))}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
