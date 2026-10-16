import {
  type FormEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useState,
} from 'react';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type {
  NodeBlockExceptionsViewModel,
  NodeBlockSourceViewModel,
  NodeBlockTargetViewModel,
  PendingNodeBlockEntriesViewModel,
} from '../../../../contexts/nodeAccess/presentation/view-models/NodeAccessViewModels';
import type { NodeAccessAction } from './useNodeAccessAction';

import { Field } from '../../../../contexts/identities/presentation/auth/Field';
import { SegmentedControl } from '../../../../shared/presentation/components/segmentedControl';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { applicationContainer } from '../../../composition/applicationContainer';
import {
  formatNodeAccessDate,
  NodeAccessEmpty,
  NodeAccessIdentityRow,
  nodeAccessIdentityId,
  NodeAccessPeerRow,
  NodeAccessSection,
  NodeAccessStatus,
} from './NodeAccessParts';
import { useNodeAccessAction } from './useNodeAccessAction';

type NodeBlockTargetKind = 'identity' | 'node';

const fetchOutcomes: Record<string, string> = copy.nodeAccess.fetchOutcomes;

function sourceDiagnostics(source: NodeBlockSourceViewModel): string {
  if (source.lastFetchedAt === null) return copy.nodeAccess.neverChecked;

  return copy.nodeAccess.lastChecked
    .replace('{date}', formatNodeAccessDate(source.lastFetchedAt))
    .replace(
      '{outcome}',
      (source.lastFetchOutcome && fetchOutcomes[source.lastFetchOutcome]) ??
        copy.nodeAccess.neverChecked,
    );
}

function PendingEntriesReview({
  action,
  onSourceChanged,
  session,
  source,
}: {
  action: NodeAccessAction;
  onSourceChanged: (source: NodeBlockSourceViewModel) => void;
  session: Session;
  source: NodeBlockSourceViewModel;
}): ReactElement {
  const { busy, run } = action;
  const owner = source.ownerIdentityId;
  const [pending, setPending] =
    useState<PendingNodeBlockEntriesViewModel | null>(null);

  const load = useCallback(async () => {
    setPending(
      await applicationContainer.nodeAccess.getPendingEntries(owner, session),
    );
  }, [owner, session]);

  useEffect(() => {
    void run('pending', load, { failure: copy.nodeAccess.loadError });
  }, [load, run]);

  const version = pending?.version ?? null;

  const approve = (entry: NodeBlockTargetViewModel | undefined) => {
    if (busy || version === null) return;

    void run(
      'approve',
      async () => {
        try {
          onSourceChanged(
            await applicationContainer.nodeAccess.approvePendingEntries(
              owner,
              version,
              entry,
              session,
            ),
          );
        } finally {
          // A stale version is refused (409) with nothing applied; reloading
          // shows the newer version that now waits for review.
          await load();
        }
      },
      { success: copy.nodeAccess.approved },
    );
  };

  const approveButton = (entry: NodeBlockTargetViewModel) => (
    <button
      type="button"
      className="ui-button"
      disabled={version === null || busy !== null}
      onClick={() => approve(entry)}
    >
      {copy.nodeAccess.approve}
    </button>
  );
  const empty =
    pending !== null &&
    pending.blockedIdentityIds.length === 0 &&
    pending.blockedNodePeerIds.length === 0;

  return (
    <div className="grid gap-2 border-l border-white/10 pl-3">
      {empty ? (
        <NodeAccessEmpty text={copy.nodeAccess.pendingEmpty} />
      ) : (
        <>
          {version === null ? null : (
            <div className="text-xs text-white/55">
              {copy.nodeAccess.pendingVersion.replace(
                '{version}',
                String(version),
              )}
            </div>
          )}
          <div>
            {pending?.blockedIdentityIds.map((identityId) => (
              <NodeAccessIdentityRow
                key={identityId}
                identityId={identityId}
                action={approveButton({ identityId })}
              />
            ))}
            {pending?.blockedNodePeerIds.map((nodePeerId) => (
              <NodeAccessPeerRow
                key={nodePeerId}
                peerId={nodePeerId}
                action={approveButton({ nodePeerId })}
              />
            ))}
          </div>
          <button
            type="button"
            className="ui-button ui-button-primary justify-self-end"
            disabled={version === null || busy !== null}
            onClick={() => approve(undefined)}
          >
            {copy.nodeAccess.approveAll}
          </button>
        </>
      )}
    </div>
  );
}

function BlockSourceRow({
  action,
  onSourceChanged,
  onUnfollow,
  session,
  source,
}: {
  action: NodeAccessAction;
  onSourceChanged: (source: NodeBlockSourceViewModel) => void;
  onUnfollow: () => void;
  session: Session;
  source: NodeBlockSourceViewModel;
}): ReactElement {
  const [reviewing, setReviewing] = useState(false);
  const { busy, run } = action;

  const changeAutoApply = (autoApply: boolean) => {
    if (busy || autoApply === source.autoApply) return;

    void run(
      'auto-apply',
      async () => {
        onSourceChanged(
          await applicationContainer.nodeAccess.followSource(
            {
              autoApply,
              origin: source.origin,
              ownerIdentityId: source.ownerIdentityId,
            },
            session,
          ),
        );
      },
      { success: copy.nodeAccess.sourceUpdated },
    );
  };

  return (
    <div
      className="ui-list-block grid gap-2"
      data-source={source.ownerIdentityId}
    >
      <NodeAccessIdentityRow
        identityId={source.ownerIdentityId}
        action={
          <button
            type="button"
            className="ui-button ui-button-danger"
            disabled={busy !== null}
            onClick={onUnfollow}
          >
            {copy.nodeAccess.unfollow}
          </button>
        }
      />
      <div className="break-all font-mono text-xs text-white/55">
        {source.origin}
      </div>
      <div className="text-xs leading-5 text-white/45">
        {source.version === null
          ? null
          : `${copy.nodeAccess.sourceVersion.replace('{version}', String(source.version))} · `}
        {copy.nodeAccess.sourceCounts
          .replace('{applied}', String(source.appliedCount))
          .replace('{pending}', String(source.pendingCount))}
        <br />
        {sourceDiagnostics(source)}
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-center sm:justify-between">
        <SegmentedControl
          dense
          onChange={(value) => changeAutoApply(value === 'auto')}
          options={[
            { label: copy.nodeAccess.autoApplyOff, value: 'review' },
            { label: copy.nodeAccess.autoApplyOn, value: 'auto' },
          ]}
          value={source.autoApply ? 'auto' : 'review'}
        />
        <span className="text-xs leading-5 text-white/45 sm:order-last sm:col-span-2">
          {copy.nodeAccess.autoApplyHelp}
        </span>
        {source.pendingCount > 0 && !source.autoApply ? (
          <button
            type="button"
            className="ui-button"
            onClick={() => setReviewing((current) => !current)}
          >
            {copy.nodeAccess.review.replace(
              '{count}',
              String(source.pendingCount),
            )}
          </button>
        ) : null}
      </div>
      {reviewing && source.pendingCount > 0 && !source.autoApply ? (
        <PendingEntriesReview
          action={action}
          onSourceChanged={onSourceChanged}
          session={session}
          source={source}
        />
      ) : null}
    </div>
  );
}

function PublicationSection({
  action,
  onChange,
  published,
  session,
}: {
  action: NodeAccessAction;
  onChange: (published: boolean) => void;
  published: boolean | null;
  session: Session;
}): ReactElement {
  const { busy, run } = action;

  const togglePublication = () => {
    if (busy || published === null) return;

    void run(
      'publication',
      async () => {
        onChange(
          await applicationContainer.nodeAccess.changePublication(
            !published,
            session,
          ),
        );
      },
      { success: copy.nodeAccess.sourceUpdated },
    );
  };

  return (
    <NodeAccessSection
      body={copy.nodeAccess.publicationBody}
      title={copy.nodeAccess.publicationTitle}
    >
      {published === null ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-white/70">
            {published
              ? copy.nodeAccess.publicationOn
              : copy.nodeAccess.publicationOff}
          </span>
          <button
            type="button"
            className={published ? 'ui-button' : 'ui-button ui-button-primary'}
            disabled={busy !== null}
            onClick={togglePublication}
          >
            {published
              ? copy.nodeAccess.stopPublishing
              : copy.nodeAccess.publish}
          </button>
        </div>
      )}
    </NodeAccessSection>
  );
}

function FollowSourceForm({
  action,
  onFollowed,
  session,
}: {
  action: NodeAccessAction;
  onFollowed: (source: NodeBlockSourceViewModel) => void;
  session: Session;
}): ReactElement {
  const { busy, run } = action;
  const [owner, setOwner] = useState('');
  const [origin, setOrigin] = useState('');
  const [autoApply, setAutoApply] = useState(false);
  const incomplete = !owner.trim() || !origin.trim();

  const followSource = (event: FormEvent) => {
    event.preventDefault();

    if (busy || incomplete) return;

    void run(
      'follow',
      async () => {
        onFollowed(
          await applicationContainer.nodeAccess.followSource(
            {
              autoApply,
              origin: origin.trim(),
              ownerIdentityId: await nodeAccessIdentityId(owner),
            },
            session,
          ),
        );
        setOwner('');
        setOrigin('');
        setAutoApply(false);
      },
      { success: copy.nodeAccess.followed },
    );
  };

  return (
    <NodeAccessSection title={copy.nodeAccess.followTitle}>
      <form className="grid gap-3" onSubmit={followSource}>
        <Field label={copy.nodeAccess.owner}>
          <input
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            className="ui-field-control px-3 py-2 text-sm placeholder:text-white/30"
            placeholder={copy.identityLookup.placeholder}
            title={copy.identityLookup.help}
          />
        </Field>
        <Field label={copy.nodeAccess.origin}>
          <input
            type="url"
            inputMode="url"
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            className="ui-field-control px-3 py-2 text-sm placeholder:text-white/30"
            placeholder={copy.nodeAccess.originPlaceholder}
          />
        </Field>
        <label className="flex items-start gap-3 text-sm text-white/70">
          <input
            type="checkbox"
            checked={autoApply}
            onChange={(event) => setAutoApply(event.target.checked)}
            className="mt-1"
          />
          <span>
            {copy.nodeAccess.autoApply}
            <span className="block text-xs text-white/45">
              {copy.nodeAccess.autoApplyHelp}
            </span>
          </span>
        </label>
        <button
          type="submit"
          className="ui-button ui-button-primary justify-self-end"
          disabled={incomplete || busy !== null}
        >
          {copy.nodeAccess.follow}
        </button>
      </form>
    </NodeAccessSection>
  );
}

function ExceptionList({
  exceptions,
  onRemove,
  removing,
}: {
  exceptions: NodeBlockExceptionsViewModel | null;
  onRemove: (target: NodeBlockTargetViewModel) => void;
  removing: boolean;
}): ReactElement {
  const identityIds = exceptions?.identityIds ?? [];
  const nodePeerIds = exceptions?.nodePeerIds ?? [];

  if (identityIds.length === 0 && nodePeerIds.length === 0) {
    return <NodeAccessEmpty text={copy.nodeAccess.exceptionsEmpty} />;
  }

  const removeButton = (target: NodeBlockTargetViewModel) => (
    <button
      type="button"
      className="ui-button"
      disabled={removing}
      onClick={() => onRemove(target)}
    >
      {copy.nodeAccess.remove}
    </button>
  );

  return (
    <div>
      {identityIds.map((identityId) => (
        <NodeAccessIdentityRow
          key={identityId}
          identityId={identityId}
          action={removeButton({ identityId })}
        />
      ))}
      {nodePeerIds.map((nodePeerId) => (
        <NodeAccessPeerRow
          key={nodePeerId}
          peerId={nodePeerId}
          action={removeButton({ nodePeerId })}
        />
      ))}
    </div>
  );
}

function ExceptionsSection({
  action,
  exceptions,
  onChange,
  session,
}: {
  action: NodeAccessAction;
  exceptions: NodeBlockExceptionsViewModel | null;
  onChange: (exceptions: NodeBlockExceptionsViewModel) => void;
  session: Session;
}): ReactElement {
  const { busy, run } = action;
  const [kind, setKind] = useState<NodeBlockTargetKind>('identity');
  const [input, setInput] = useState('');
  const isIdentity = kind === 'identity';

  const changeException = (
    target: () => NodeBlockTargetViewModel | Promise<NodeBlockTargetViewModel>,
    excepted: boolean,
    after?: () => void,
  ) => {
    if (busy) return;

    void run(
      'exception',
      async () => {
        const resolved = await target();

        onChange(
          excepted
            ? await applicationContainer.nodeAccess.except(resolved, session)
            : await applicationContainer.nodeAccess.removeException(
                resolved,
                session,
              ),
        );
        after?.();
      },
      { success: copy.nodeAccess.exceptionsUpdated },
    );
  };

  const addException = (event: FormEvent) => {
    event.preventDefault();

    if (!input.trim()) return;

    changeException(
      async () =>
        isIdentity
          ? { identityId: await nodeAccessIdentityId(input) }
          : { nodePeerId: input.trim() },
      true,
      () => setInput(''),
    );
  };

  return (
    <NodeAccessSection
      body={copy.nodeAccess.exceptionsBody}
      title={copy.nodeAccess.exceptionsTitle}
    >
      <ExceptionList
        exceptions={exceptions}
        onRemove={(target) => changeException(() => target, false)}
        removing={busy !== null}
      />
      <form className="grid gap-2" onSubmit={addException}>
        <SegmentedControl
          dense
          onChange={setKind}
          options={[
            { label: copy.nodeAccess.identity, value: 'identity' },
            { label: copy.nodeAccess.node, value: 'node' },
          ]}
          value={kind}
        />
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-label={
              isIdentity
                ? copy.identityLookup.label
                : copy.nodeAccess.nodePeerLabel
            }
            className="ui-field-control px-3 py-2 text-sm placeholder:text-white/30"
            placeholder={
              isIdentity
                ? copy.identityLookup.placeholder
                : copy.nodeAccess.nodePeerPlaceholder
            }
          />
          <button
            type="submit"
            className="ui-button"
            disabled={!input.trim() || busy !== null}
          >
            {copy.nodeAccess.exceptionsTitle}
          </button>
        </div>
      </form>
    </NodeAccessSection>
  );
}

export function NodeBlockSharingPanel({
  session,
}: {
  session: Session;
}): ReactElement {
  const action = useNodeAccessAction();
  const { busy, error, notice, run } = action;
  const [published, setPublished] = useState<boolean | null>(null);
  const [sources, setSources] = useState<NodeBlockSourceViewModel[]>([]);
  const [exceptions, setExceptions] =
    useState<NodeBlockExceptionsViewModel | null>(null);

  useEffect(() => {
    void run(
      'load',
      async () => {
        const [currentPublication, currentSources, currentExceptions] =
          await Promise.all([
            applicationContainer.nodeAccess.getPublication(session),
            applicationContainer.nodeAccess.getSources(session),
            applicationContainer.nodeAccess.getExceptions(session),
          ]);

        setPublished(currentPublication);
        setSources(currentSources);
        setExceptions(currentExceptions);
      },
      { failure: copy.nodeAccess.loadError },
    );
  }, [run, session]);

  const replaceSource = (source: NodeBlockSourceViewModel) => {
    setSources((current) => [
      ...current.filter(
        (item) => item.ownerIdentityId !== source.ownerIdentityId,
      ),
      source,
    ]);
  };

  const unfollowSource = (ownerIdentityId: string) => {
    if (busy || !window.confirm(copy.nodeAccess.unfollowConfirm)) return;

    void run(
      'unfollow',
      async () => {
        setSources(
          await applicationContainer.nodeAccess.unfollowSource(
            ownerIdentityId,
            session,
          ),
        );
      },
      { success: copy.nodeAccess.unfollowed },
    );
  };

  return (
    <div className="grid content-start gap-6" data-testid="node-sharing-panel">
      <NodeAccessStatus error={error} notice={notice} />

      <PublicationSection
        action={action}
        onChange={setPublished}
        published={published}
        session={session}
      />

      <NodeAccessSection title={copy.nodeAccess.sourcesTitle}>
        {sources.length === 0 ? (
          <NodeAccessEmpty text={copy.nodeAccess.sourcesEmpty} />
        ) : (
          <div>
            {sources.map((source) => (
              <BlockSourceRow
                key={source.ownerIdentityId}
                action={action}
                onSourceChanged={replaceSource}
                onUnfollow={() => unfollowSource(source.ownerIdentityId)}
                session={session}
                source={source}
              />
            ))}
          </div>
        )}
      </NodeAccessSection>

      <FollowSourceForm
        action={action}
        onFollowed={replaceSource}
        session={session}
      />

      <ExceptionsSection
        action={action}
        exceptions={exceptions}
        onChange={setExceptions}
        session={session}
      />
    </div>
  );
}
