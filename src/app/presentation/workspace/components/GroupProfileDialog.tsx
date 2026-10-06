import type { MouseEvent } from 'react';

import { createPortal } from 'react-dom';

import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type {
  ConversationResource,
  IdentityPresence,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { shortId } from '../../../../shared/presentation/formatting';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import {
  IdentityMemberListPanel,
  type IdentityMemberListItem,
} from '../../../../contexts/identities/presentation/components/IdentityMemberListPanel';
import {
  groupRosterPermissions,
  type GroupRosterActionsController,
} from './useGroupRosterActions';

type GroupParticipant = {
  identity?: IdentityResource;
  identityId: string;
  name?: string;
  picture?: null | string;
};

interface GroupProfileDialogProps {
  conversation: ConversationResource;
  currentIdentityId: string;
  networkId?: string;
  nodeNetworks: NodeNetwork[];
  onClose: () => void;
  onIdentityClick: (
    participant: GroupParticipant,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  participants: GroupParticipant[];
  presenceByIdentityId?: Record<string, IdentityPresence>;
  roster: GroupRosterActionsController;
}

export function GroupProfileDialog({
  conversation,
  currentIdentityId,
  networkId,
  nodeNetworks,
  onClose,
  onIdentityClick,
  participants,
  presenceByIdentityId = {},
  roster,
}: GroupProfileDialogProps) {
  const { close, state } = useCloseTransition(onClose);

  useCloseOnEscape(close);

  const permissions = groupRosterPermissions(conversation, currentIdentityId);
  const adminIds = conversation.adminIds;

  const groupName = conversation.name ?? conversation.id;
  const networkName = networkId
    ? (nodeNetworks.find((network) => network.id === networkId)?.name ??
      shortId(networkId))
    : copy.profile.noNetworks;

  return createPortal(
    <div
      className="app-overlay-scrim fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-md"
      data-state={state}
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={close}
        aria-label={copy.dialog.close}
      />
      <section
        className="app-overlay-surface glass-panel-strong relative z-10 w-full max-w-md overflow-hidden rounded-2xl p-5 shadow-2xl shadow-black/40"
        data-state={state}
      >
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
            onClick={close}
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

        <IdentityMemberListPanel
          className="mt-4"
          emptyLabel={copy.communities.noMatchingMembers}
          items={participants.map(
            (participant) =>
              ({
                identity: participant.identity,
                identityId: participant.identityId,
                name: participant.name,
                owner: participant.identityId === conversation.creatorId,
                pictureUrl: participant.picture ?? null,
                presence: presenceByIdentityId[participant.identityId],
              }) satisfies IdentityMemberListItem,
          )}
          listClassName="max-h-[45vh] flex-none"
          ownerLabel={copy.chat.creatorLabel}
          rowActions={(item) => (
            <div className="flex flex-wrap items-center gap-2 px-1 pt-1">
              {adminIds.includes(item.identityId) && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-white/60">
                  {copy.chat.adminLabel}
                </span>
              )}
              {permissions.canPromote(item.identityId) && (
                <RosterButton
                  disabled={roster.pending}
                  label={copy.chat.promoteAdmin}
                  onClick={() => void roster.promoteAdmin(item.identityId)}
                />
              )}
              {permissions.canDemote(item.identityId) && (
                <RosterButton
                  disabled={roster.pending}
                  label={copy.chat.demoteAdmin}
                  onClick={() => void roster.demoteAdmin(item.identityId)}
                />
              )}
              {permissions.canRemove(item.identityId) && (
                <RosterButton
                  disabled={roster.pending}
                  label={copy.chat.removeMember}
                  onClick={() => {
                    if (!window.confirm(copy.chat.removeMemberConfirm)) return;

                    void roster.removeParticipant(item.identityId);
                  }}
                />
              )}
            </div>
          )}
          onItemClick={(participant, event) =>
            onIdentityClick(
              {
                identity: participant.identity,
                identityId: participant.identityId,
                name: participant.name ?? shortId(participant.identityId),
                picture: participant.pictureUrl,
              },
              event,
            )
          }
        />
        {roster.error && (
          <p className="mt-3 text-xs font-semibold text-rose-300" role="alert">
            {roster.error}
          </p>
        )}
      </section>
    </div>,
    document.body,
  );
}

function RosterButton({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/80 transition hover:bg-white/15 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
