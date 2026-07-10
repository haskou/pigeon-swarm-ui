import { FormEvent, useState } from 'react';
import { createPortal } from 'react-dom';

import type { PollOption } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { cx } from '../../../../shared/presentation/cx';

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
  const { close, state: transitionState } = useCloseTransition(onClose);

  useCloseOnEscape(close);

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
    <div
      className="app-overlay-scrim fixed inset-0 z-[120] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4"
      data-state={transitionState}
    >
      <button
        type="button"
        className="absolute inset-0"
        onClick={close}
        aria-label={copy.dialog.close}
      />
      <form
        onSubmit={(event) => void submit(event)}
        className="app-overlay-surface app-safe-area-panel ui-dialog-surface relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden sm:h-auto sm:max-h-[88vh] sm:max-w-lg"
        data-state={transitionState}
      >
        <DialogHeader
          description={copy.polls.createBody}
          title={copy.polls.create}
          onClose={close}
        />
        <div className="min-h-0 overflow-y-auto px-5 pb-5">
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-white/65">
              {copy.polls.question}
            </span>
            <textarea
              value={question}
              maxLength={QUESTION_MAX_LENGTH}
              onChange={(event) => setQuestion(event.target.value)}
              className="ui-field-control mt-2 min-h-20 resize-none px-4 py-3 text-sm"
            />
          </label>
          <div className="mt-4 grid gap-2">
            <div className="text-sm font-semibold text-white/65">
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
                        candidateIndex === index
                          ? event.target.value
                          : candidate,
                      ),
                    )
                  }
                  className="ui-field-control min-w-0 flex-1 px-4 py-3 text-sm"
                  placeholder={`${copy.polls.option} ${index + 1}`}
                />
                {options.length > MIN_OPTIONS && (
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((current) =>
                        current.filter(
                          (_, candidateIndex) => candidateIndex !== index,
                        ),
                      )
                    }
                    className="ui-icon-button h-12 w-12 shrink-0 border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
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
                className="ui-button"
              >
                + {copy.polls.option}
              </button>
            )}
          </div>
          <label className="mt-4 flex min-h-12 cursor-pointer items-center gap-3 border-y border-white/10 px-1 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/[0.04] hover:text-white">
            <span className="min-w-0 flex-1">{copy.polls.multipleVotes}</span>
            <input
              type="checkbox"
              role="switch"
              checked={allowsMultipleVotes}
              onChange={(event) => setAllowsMultipleVotes(event.target.checked)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={cx(
                'relative h-6 w-11 shrink-0 rounded-full border transition',
                allowsMultipleVotes
                  ? 'border-cyan-200/30 bg-cyan-400/65'
                  : 'border-white/12 bg-white/12',
              )}
            >
              <span
                className={cx(
                  'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition',
                  allowsMultipleVotes ? 'left-[1.3rem]' : 'left-0.5',
                )}
              />
            </span>
          </label>
          {error && (
            <div className="ui-inline-notice mt-4 border-rose-300/25 bg-rose-500/10 text-xs text-rose-100">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="ui-button ui-button-primary mt-5 w-full"
          >
            {loading ? copy.polls.creating : copy.polls.create}
          </button>
        </div>
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
