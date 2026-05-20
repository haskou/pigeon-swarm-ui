import { copy } from '../../../../shared/presentation/i18n/copy';

interface ChatEmptyStateProps {
  onCreate: () => void;
}

export function ChatEmptyState({ onCreate }: ChatEmptyStateProps) {
  return (
    <div className="grid flex-1 place-items-center p-6 text-center">
      <div className="max-w-md">
        <img
          src="/noConversations.png"
          alt="Pigeon Swarm"
          className="mx-auto"
        />
        <h2 className="mt-6 text-3xl font-black tracking-tight">
          {copy.chat.emptyTitle}
        </h2>
        <p className="mt-3 text-white/55">{copy.chat.emptyBody}</p>
        <button
          onClick={onCreate}
          className="mt-6 rounded-2xl bg-fuchsia-500 px-5 py-3 font-black"
        >
          {copy.chat.createConversation}
        </button>
      </div>
    </div>
  );
}
