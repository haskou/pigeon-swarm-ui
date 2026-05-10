import type {
  ChatMessage,
  ConversationResource,
  Session,
} from '../../domain/types';

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
      <SectionTitle title="Identity" />
      <div className="rounded-3xl bg-white/8 p-4">
        <div className="font-black">{session.identity.profile.name}</div>
        <div className="mt-1 break-all text-xs text-white/45">
          {session.identity.id}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Badge label={`v${session.identity.version}`} />
          <Badge label={`${session.identity.networks.length} nets`} />
        </div>
      </div>

      <SectionTitle title="Conversation keychain" className="mt-6" />
      <div className="rounded-3xl bg-white/8 p-4">
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-white/50">Private key</span>
          <b className={key ? 'text-emerald-300' : 'text-rose-300'}>
            {key ? 'present' : 'missing'}
          </b>
        </div>
        <div className="mt-3 flex justify-between gap-3 text-sm">
          <span className="text-white/50">Keychain version</span>
          <b>{session.keychain.version}</b>
        </div>
        <div className="mt-3 flex justify-between gap-3 text-sm">
          <span className="text-white/50">Stored 1to1 keys</span>
          <b>{Object.keys(session.keychain.conversations).length}</b>
        </div>
      </div>

      <SectionTitle title="Loaded messages" className="mt-6" />
      <div className="rounded-3xl bg-white/8 p-4">
        <div className="text-4xl font-black">{messages.length}</div>
        <div className="mt-1 text-sm text-white/45">
          events projected locally
        </div>
      </div>

      <SectionTitle title="Future" className="mt-6" />
      <div className="space-y-2 text-sm text-white/55">
        <div className="rounded-2xl bg-white/8 p-3">
          Communities: same sidebar slot, disabled for now.
        </div>
        <div className="rounded-2xl bg-white/8 p-3">
          Voice: channel model already has a home in the rail.
        </div>
      </div>
    </aside>
  );
}
