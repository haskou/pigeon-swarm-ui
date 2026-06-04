import { copy } from '../../../../shared/presentation/i18n/copy';

type InvitationKeyPromptKind = 'community' | 'conversation';

interface InvitationKeyPromptProps {
  accepting?: boolean;
  error?: null | string;
  inviterName?: string;
  kind: InvitationKeyPromptKind;
  onAccept: () => void;
  onManualImport?: () => void;
}

export function InvitationKeyPrompt({
  accepting = false,
  error,
  inviterName,
  kind,
  onAccept,
  onManualImport,
}: InvitationKeyPromptProps) {
  const title =
    kind === 'community'
      ? copy.notifications.communityInviteKeyTitle
      : copy.notifications.conversationInviteKeyTitle;

  return (
    <div className="grid min-h-[28vh] place-items-center px-2 py-6">
      <div className="w-full max-w-lg rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-5 text-sm text-white shadow-2xl shadow-cyan-950/20">
        <div>
          <div className="min-w-0">
            <div className="text-base font-black">{title}</div>
            {inviterName ? (
              <div className="mt-1 text-xs font-bold text-cyan-100/65">
                {copy.notifications.inviteKeyInvitedBy}: {inviterName}
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-4 leading-6 text-white/70">
          {copy.notifications.inviteKeyBody}
        </p>
        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-100">
            {error}
          </div>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={accepting}
            onClick={onAccept}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {accepting
              ? copy.notifications.inviteKeyWorking
              : copy.notifications.inviteKeyAction}
          </button>
          {onManualImport ? (
            <button
              type="button"
              onClick={onManualImport}
              className="rounded-2xl px-4 py-2 text-sm font-black text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              {copy.notifications.inviteKeyManual}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
