import { copy } from '../../../../shared/presentation/i18n/copy';

export type PushNotificationPromptState = 'error' | 'idle' | 'loading';

type PushNotificationPromptProps = {
  enableState: PushNotificationPromptState;
  error: null | string;
  onDismiss: () => void;
  onEnable: () => void;
};

export function PushNotificationPrompt({
  enableState,
  error,
  onDismiss,
  onEnable,
}: PushNotificationPromptProps) {
  const loading = enableState === 'loading';

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-30 flex justify-center lg:bottom-5">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-cyan-200/25 bg-[#171827]/95 p-3 shadow-2xl shadow-black/35 backdrop-blur">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-300/15 text-cyan-100">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
            >
              <path
                d="M18 9.5a6 6 0 0 0-12 0v3.2L4.7 15a1 1 0 0 0 .9 1.5h12.8a1 1 0 0 0 .9-1.5L18 12.7V9.5Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
              <path
                d="M9.6 19a2.6 2.6 0 0 0 4.8 0"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
              />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black leading-tight text-white">
              {copy.notifications.enablePushTitle}
            </p>
            <p className="mt-1 text-xs leading-snug text-white/60">
              {error ?? copy.notifications.enablePushBody}
            </p>
            <button
              type="button"
              onClick={onEnable}
              disabled={loading}
              className="mt-3 min-h-10 w-full rounded-xl bg-cyan-100 px-4 text-sm font-black text-[#111827] transition hover:bg-white disabled:cursor-wait disabled:opacity-70 sm:w-auto"
            >
              {loading
                ? copy.notifications.enablePushLoading
                : copy.notifications.enablePush}
            </button>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 text-white/65 transition hover:bg-white/15 hover:text-white"
            aria-label={copy.notifications.enablePushDismiss}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
            >
              <path
                d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
