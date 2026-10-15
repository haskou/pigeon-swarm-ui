import type { ReactElement, ReactNode } from 'react';

import { useIdentityPreview } from '../../../../contexts/identities/presentation/hooks/useIdentityPreview';
import { cx } from '../../../../shared/presentation/cx';
import { shortId } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { applicationContainer } from '../../../composition/applicationContainer';

/** Resolves `@handle` to its identity id; anything else is taken as an id. */
export async function nodeAccessIdentityId(input: string): Promise<string> {
  const value = input.trim();

  if (!value.startsWith('@')) return value;

  return (
    await applicationContainer.identities.get(value.slice(1).toLowerCase())
  ).id;
}

export function formatNodeAccessDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

export function NodeAccessStatus({
  error,
  notice,
}: {
  error: null | string;
  notice: null | string;
}): ReactElement | null {
  if (!error && !notice) return null;

  return (
    <div
      role={error ? 'alert' : 'status'}
      className={cx(
        'ui-inline-notice break-words',
        error
          ? 'border-rose-300/25 bg-rose-500/15 text-rose-100'
          : 'border-emerald-300/25 bg-emerald-500/15 text-emerald-100',
      )}
    >
      {error ?? notice}
    </div>
  );
}

export function NodeAccessSection({
  body,
  children,
  title,
}: {
  body?: string;
  children: ReactNode;
  title: string;
}): ReactElement {
  return (
    <section className="grid gap-3 border-b border-white/10 pb-5">
      <div>
        <h3 className="text-sm font-black text-white/85">{title}</h3>
        {body ? (
          <p className="mt-1 text-sm leading-6 text-white/45">{body}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** One identity of a list, with its profile name when this node knows it. */
export function NodeAccessIdentityRow({
  action,
  identityId,
}: {
  action?: ReactNode;
  identityId: string;
}): ReactElement {
  const preview = useIdentityPreview(identityId);
  const name = preview.identity?.profile.name.trim();

  return (
    <div className="ui-list-row" data-identity-id={identityId}>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-white/85">
          {name || (preview.loaded ? copy.nodeAccess.unknownIdentity : '…')}
        </div>
        <div className="truncate text-xs text-white/40" title={identityId}>
          {shortId(identityId)}
        </div>
      </div>
      {action}
    </div>
  );
}

/** One node of a list, shown by its libp2p peer id. */
export function NodeAccessPeerRow({
  action,
  peerId,
}: {
  action?: ReactNode;
  peerId: string;
}): ReactElement {
  return (
    <div className="ui-list-row" data-peer-id={peerId}>
      <div
        className="min-w-0 flex-1 truncate font-mono text-xs text-white/70"
        title={peerId}
      >
        {peerId}
      </div>
      {action}
    </div>
  );
}

export function NodeAccessEmpty({ text }: { text: string }): ReactElement {
  return <p className="py-2 text-sm text-white/40">{text}</p>;
}
