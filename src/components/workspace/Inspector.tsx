import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../domain/types';
import type { Peer } from '../../application/peers/ListPeers';
import type { ReactNode } from 'react';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { shortId } from '../../utils/formatting';
import { Badge } from '../common/Badge';
import { SectionTitle } from '../common/SectionTitle';

interface InspectorProps {
  session: Session;
  activeConversation?: ConversationResource;
  className?: string;
  messages: ChatMessage[];
  onClose?: () => void;
  peers: Peer[];
}

export function Inspector({
  activeConversation,
  className,
  messages,
  onClose,
  peers,
  session,
}: InspectorProps) {
  const key = activeConversation
    ? session.keychain.conversations[activeConversation.id]
    : undefined;

  return (
    <aside className={cx('glass-panel rounded-[2rem] p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <SectionTitle title={copy.inspector.identity} />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15 xl:hidden"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        )}
      </div>
      <div className="rounded-3xl bg-white/8 p-4">
        <div className="font-black">{session.identity.profile.name}</div>
        <div className="mt-1 break-all text-xs text-white/45">
          {session.identity.id}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Badge label={`v${session.identity.version}`} />
          <Badge
            label={`${session.identity.networks.length} ${copy.inspector.nets}`}
          />
        </div>
      </div>

      <SectionTitle
        title={copy.inspector.conversationKeychain}
        className="mt-6"
      />
      <div className="rounded-3xl bg-white/8 p-4">
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-white/50">{copy.inspector.privateKey}</span>
          <b className={key ? 'text-emerald-300' : 'text-rose-300'}>
            {key ? copy.inspector.present : copy.inspector.missing}
          </b>
        </div>
        <div className="mt-3 flex justify-between gap-3 text-sm">
          <span className="text-white/50">
            {copy.inspector.keychainVersion}
          </span>
          <b>{session.keychain.version}</b>
        </div>
        <div className="mt-3 flex justify-between gap-3 text-sm">
          <span className="text-white/50">{copy.inspector.storedOneKeys}</span>
          <b>{Object.keys(session.keychain.conversations).length}</b>
        </div>
      </div>

      <SectionTitle title={copy.inspector.loadedMessages} className="mt-6" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <MetricCard
          icon={<MessagesIcon />}
          label={copy.inspector.eventsProjectedLocally}
          value={`${messages.length}`}
        />
        <MetricCard
          icon={<PeersIcon />}
          label={copy.peers.title}
          value={`${peers.length}`}
        />
      </div>

      <SectionTitle title={copy.peers.title} className="mt-6" />
      <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
        {peers.length === 0 ? (
          <div className="rounded-3xl bg-white/8 p-4 text-sm text-white/45">
            {copy.peers.empty}
          </div>
        ) : (
          peers.map((peer) => <PeerSummary key={peer.id} peer={peer} />)
        )}
      </div>
    </aside>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl bg-white/8 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white/75">
          {icon}
        </div>
        <div className="text-4xl font-black">{value}</div>
      </div>
      <div className="mt-2 text-sm text-white/45">{label}</div>
    </div>
  );
}

function PeerSummary({ peer }: { peer: Peer }) {
  return (
    <article className="rounded-3xl bg-white/8 p-3 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-black">{shortId(peer.id)}</div>
          <div className="mt-1 truncate text-white/40">
            {peer.owner ? shortId(peer.owner) : copy.peers.unclaimed}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-fuchsia-500/20 px-2 py-1 font-black text-fuchsia-100">
          {peer.networks.length}
        </span>
      </div>
      <div className="mt-2 truncate text-white/45">
        {peer.networks.length > 0
          ? peer.networks.map((network) => network.name).join(', ')
          : copy.peers.noNetworks}
      </div>
    </article>
  );
}

function MessagesIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M5 6.5h14M5 12h10M5 17.5h7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PeersIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3.5 19c.8-3 2.5-4.5 4.5-4.5s3.7 1.5 4.5 4.5M11.5 19c.8-3 2.5-4.5 4.5-4.5s3.7 1.5 4.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
