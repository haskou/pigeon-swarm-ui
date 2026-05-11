import type { ConversationResource, Session } from '../../domain/types';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { conversationTitle, shortId } from '../../utils/formatting';
import { PlaceholderRow } from '../common/PlaceholderRow';
import { SectionTitle } from '../common/SectionTitle';

interface SidebarProps {
  session: Session;
  conversations: ConversationResource[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function Sidebar({
  activeConversationId,
  conversations,
  onCreate,
  onSelect,
  session,
}: SidebarProps) {
  return (
    <aside className="glass-panel-strong flex h-full min-h-0 flex-col rounded-[2rem] p-4">
      <div className="flex items-center gap-3 rounded-3xl bg-white/10 p-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-lg font-black text-slate-950">
          {session.identity.profile.name.slice(0, 1).toUpperCase() || 'P'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-black">
            {session.identity.profile.name}
          </div>
          <div className="truncate text-xs text-white/50">
            {shortId(session.identity.id)}
          </div>
        </div>
      </div>

      <button
        onClick={onCreate}
        className="glass-button mt-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-4 py-3 text-sm font-black shadow-xl shadow-fuchsia-950/20"
      >
        {copy.sidebar.createConversation}
      </button>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <SectionTitle title={copy.sidebar.communitiesTitle} />
        <div className="space-y-2 opacity-70">
          <PlaceholderRow
            title={copy.sidebar.publicSwarmTitle}
            subtitle={copy.sidebar.publicSwarmSubtitle}
          />
          <PlaceholderRow
            title={copy.sidebar.privateNetworksTitle}
            subtitle={copy.sidebar.privateNetworksSubtitle}
          />
        </div>

        <SectionTitle title={copy.sidebar.oneToOneTitle} className="mt-6" />
        <div className="space-y-2">
          {conversations.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
              {copy.sidebar.emptyConversations}
            </div>
          )}
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cx(
                'w-full rounded-3xl p-3 text-left transition',
                activeConversationId === conversation.id
                  ? 'bg-white text-slate-950'
                  : 'bg-white/8 text-white hover:bg-white/14',
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cx(
                    'grid h-11 w-11 place-items-center rounded-2xl text-sm font-black',
                    activeConversationId === conversation.id
                      ? 'bg-slate-950 text-white'
                      : 'bg-white/10 text-white',
                  )}
                >
                  {conversationTitle(conversation).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-black">
                    {conversationTitle(conversation)}
                  </div>
                  <div
                    className={cx(
                      'truncate text-xs',
                      activeConversationId === conversation.id
                        ? 'text-slate-500'
                        : 'text-white/45',
                    )}
                  >
                    {conversation.latestMessagePreview ??
                      shortId(conversation.peerIdentityId ?? conversation.id)}
                  </div>
                </div>
                {!!conversation.unreadCount && (
                  <span className="rounded-full bg-fuchsia-500 px-2 py-1 text-xs font-black text-white">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
