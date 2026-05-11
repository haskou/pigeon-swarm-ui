import { FormEvent, useState } from 'react';

import { copy } from '../../i18n/en';

const MESSAGE_MAX_LENGTH = 4000;

interface ComposerProps {
  disabled: boolean;
  error: string | null;
  onSend: (content: string) => Promise<void>;
}

export function Composer({ disabled, error, onSend }: ComposerProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = content.trim();

    if (!trimmed || trimmed.length > MESSAGE_MAX_LENGTH || sending) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setContent('');
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-white/10 p-4 sm:p-5"
    >
      {error && (
        <div className="mb-3 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
          {error}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-3xl border border-white/10 bg-black/20 p-2">
        <button
          type="button"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 font-black text-white/70"
        >
          +
        </button>
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={disabled || sending}
          maxLength={MESSAGE_MAX_LENGTH}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/35 disabled:opacity-50"
          placeholder={copy.composer.placeholder}
        />
        <span className="hidden min-w-12 text-right text-xs font-black text-white/35 sm:block">
          {content.length}/{MESSAGE_MAX_LENGTH}
        </span>
        <button
          disabled={
            !content.trim() ||
            content.trim().length > MESSAGE_MAX_LENGTH ||
            disabled ||
            sending
          }
          className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {sending ? copy.composer.sending : copy.composer.send}
        </button>
      </div>
    </form>
  );
}
