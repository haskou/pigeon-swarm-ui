import { FormEvent, useState } from 'react';
import { createPortal } from 'react-dom';

import type { PollOption } from '../../domain/types';

import { copy } from '../../i18n/en';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;
const QUESTION_MAX_LENGTH = 200;
const OPTION_MAX_LENGTH = 120;

export function CreatePollDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: {
    allowsMultipleVotes: boolean;
    options: PollOption[];
    question: string;
  }) => Promise<void>;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowsMultipleVotes, setAllowsMultipleVotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedOptions = options
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, MAX_OPTIONS);
    const validationError = validatePoll(question.trim(), parsedOptions);

    if (validationError) {
      setError(validationError);

      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        allowsMultipleVotes,
        options: parsedOptions.map((text, index) => ({
          id: pollOptionId(text, index),
          text,
        })),
        question: question.trim(),
      });
      onClose();
    } catch {
      setError(copy.polls.createError);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <form
        onSubmit={(event) => void submit(event)}
        className="glass-panel-strong relative z-10 w-full max-w-lg rounded-2xl p-5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">{copy.polls.create}</h2>
            <p className="mt-1 text-sm text-white/50">
              {copy.polls.createBody}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white/70 transition hover:bg-white/15"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        </div>
        <label className="mt-5 block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-white/35">
            {copy.polls.question}
          </span>
          <textarea
            value={question}
            maxLength={QUESTION_MAX_LENGTH}
            onChange={(event) => setQuestion(event.target.value)}
            className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60"
          />
        </label>
        <div className="mt-4 grid gap-2">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-white/35">
            {copy.polls.options}
          </div>
          {options.map((option, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={option}
                maxLength={OPTION_MAX_LENGTH}
                onChange={(event) =>
                  setOptions((current) =>
                    current.map((candidate, candidateIndex) =>
                      candidateIndex === index ? event.target.value : candidate,
                    ),
                  )
                }
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60"
                placeholder={`${copy.polls.option} ${index + 1}`}
              />
              {options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() =>
                    setOptions((current) =>
                      current.filter((_, candidateIndex) => candidateIndex !== index),
                    )
                  }
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-500/15 text-sm font-black text-rose-100 transition hover:bg-rose-500/25"
                  aria-label={copy.polls.removeOption}
                  title={copy.polls.removeOption}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={() => setOptions((current) => [...current, ''])}
              className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
            >
              + {copy.polls.option}
            </button>
          )}
        </div>
        <label className="mt-4 flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3 text-sm font-black text-white/75">
          <input
            type="checkbox"
            checked={allowsMultipleVotes}
            onChange={(event) => setAllowsMultipleVotes(event.target.checked)}
          />
          {copy.polls.multipleVotes}
        </label>
        {error && (
          <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-xs text-rose-100">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? copy.polls.creating : copy.polls.create}
        </button>
      </form>
    </div>,
    document.body,
  );
}

function validatePoll(question: string, options: string[]): string | null {
  if (!question || question.length > QUESTION_MAX_LENGTH) {
    return copy.polls.questionInvalid;
  }

  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    return copy.polls.optionsInvalid;
  }

  if (options.some((option) => option.length > OPTION_MAX_LENGTH)) {
    return copy.polls.optionInvalid;
  }

  return null;
}

function pollOptionId(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return `${slug || 'option'}-${index + 1}`;
}
