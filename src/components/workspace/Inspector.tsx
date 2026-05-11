import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../domain/types';

import { copy } from '../../i18n/en';
import { Badge } from '../common/Badge';
import { SectionTitle } from '../common/SectionTitle';

interface InspectorProps {
  session: Session;
  activeConversation?: ConversationResource;
  messages: ChatMessage[];
}

export function Inspector({
  activeConversation,
  messages,
  session,
}: InspectorProps) {
  const key = activeConversation
    ? session.keychain.conversations[activeConversation.id]
    : undefined;

  return (
    <aside className="hidden glass-panel rounded-[2rem] p-4 xl:block">
      <SectionTitle title={copy.inspector.identity} />
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
      <div className="rounded-3xl bg-white/8 p-4">
        <div className="text-4xl font-black">{messages.length}</div>
        <div className="mt-1 text-sm text-white/45">
          {copy.inspector.eventsProjectedLocally}
        </div>
      </div>
    </aside>
  );
}
