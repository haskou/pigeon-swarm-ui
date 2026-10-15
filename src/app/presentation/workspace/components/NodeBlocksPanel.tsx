import { type FormEvent, type ReactElement, useEffect, useState } from 'react';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { NodeInfo } from '../../../../contexts/networks/infrastructure/http/NodeInfo';
import type {
  NodeBlockListViewModel,
  NodeBlockTargetViewModel,
} from '../../../../contexts/nodeAccess/presentation/view-models/NodeAccessViewModels';

import { IdentityMatch } from '../../../../contexts/identities/domain/IdentityMatch';
import { Field } from '../../../../contexts/identities/presentation/auth/Field';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { applicationContainer } from '../../../composition/applicationContainer';
import { nodeBootstrapApi } from '../../../composition/nodeBootstrapApi';
import {
  NodeAccessEmpty,
  NodeAccessIdentityRow,
  nodeAccessIdentityId,
  NodeAccessPeerRow,
  NodeAccessSection,
  NodeAccessStatus,
} from './NodeAccessParts';
import { useNodeAccessAction } from './useNodeAccessAction';

class OwnNodeCannotBeBlockedError extends Error {
  public constructor() {
    super(copy.nodeAccess.cannotBlockOwnNode);
  }
}

export function NodeBlocksPanel({
  node,
  session,
}: {
  node: NodeInfo | null;
  session: Session;
}): ReactElement {
  const { busy, error, notice, run } = useNodeAccessAction();
  const [blockList, setBlockList] = useState<NodeBlockListViewModel | null>(
    null,
  );
  const [connectedPeerIds, setConnectedPeerIds] = useState<string[]>([]);
  const [identityInput, setIdentityInput] = useState('');
  const [peerInput, setPeerInput] = useState('');
  const ownPeerId = node?.relay?.peerId;
  const blockedPeerIds = new Set(blockList?.blockedNodePeerIds ?? []);
  const blockablePeerIds = connectedPeerIds.filter(
    (peerId) => peerId !== ownPeerId && !blockedPeerIds.has(peerId),
  );

  useEffect(() => {
    void run(
      'load',
      async () => {
        setBlockList(
          await applicationContainer.nodeAccess.getBlockList(session),
        );
      },
      { failure: copy.nodeAccess.loadError },
    );
  }, [run, session]);

  useEffect(() => {
    let cancelled = false;

    // The picker is a convenience: without it, peer ids are still pasted.
    void nodeBootstrapApi
      .getPeerSnapshot()
      .then((snapshot) => {
        if (!cancelled) {
          setConnectedPeerIds(snapshot.ipfsPeers.map((peer) => peer.id));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const change = (
    name: string,
    target: () => Promise<NodeBlockTargetViewModel>,
    blocked: boolean,
    after?: () => void,
  ) => {
    if (busy) return;

    void run(
      name,
      async () => {
        const resolved = await target();

        if (
          blocked &&
          (IdentityMatch.isSame(resolved.identityId, session.identity.id) ||
            (resolved.nodePeerId !== undefined &&
              resolved.nodePeerId === ownPeerId))
        ) {
          throw new OwnNodeCannotBeBlockedError();
        }

        setBlockList(
          blocked
            ? await applicationContainer.nodeAccess.block(resolved, session)
            : await applicationContainer.nodeAccess.unblock(resolved, session),
        );
        after?.();
      },
      { success: copy.nodeAccess.blocksUpdated },
    );
  };

  const blockIdentity = (event: FormEvent) => {
    event.preventDefault();

    if (!identityInput.trim()) return;

    change(
      'block-identity',
      async () => ({ identityId: await nodeAccessIdentityId(identityInput) }),
      true,
      () => setIdentityInput(''),
    );
  };

  const blockPeer = (event: FormEvent) => {
    event.preventDefault();

    const nodePeerId = peerInput.trim();

    if (!nodePeerId) return;

    change(
      'block-node',
      async () => ({ nodePeerId }),
      true,
      () => setPeerInput(''),
    );
  };

  const unblockButton = (target: NodeBlockTargetViewModel) => (
    <button
      type="button"
      className="ui-button"
      disabled={busy !== null}
      onClick={() => change('unblock', async () => target, false)}
    >
      {copy.nodeAccess.unblock}
    </button>
  );

  return (
    <div className="grid content-start gap-6" data-testid="node-blocks-panel">
      <NodeAccessStatus error={error} notice={notice} />

      <NodeAccessSection
        body={copy.nodeAccess.blocksBody}
        title={copy.nodeAccess.blocksTitle}
      >
        {blockList?.version ? (
          <p className="text-xs text-white/40">
            {copy.nodeAccess.blockListVersion.replace(
              '{version}',
              String(blockList.version),
            )}
          </p>
        ) : null}
      </NodeAccessSection>

      <NodeAccessSection title={copy.nodeAccess.blockedIdentities}>
        {blockList?.blockedIdentityIds.length ? (
          <div>
            {blockList.blockedIdentityIds.map((identityId) => (
              <NodeAccessIdentityRow
                key={identityId}
                identityId={identityId}
                action={unblockButton({ identityId })}
              />
            ))}
          </div>
        ) : (
          <NodeAccessEmpty text={copy.nodeAccess.blockedIdentitiesEmpty} />
        )}
        <form
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
          onSubmit={blockIdentity}
        >
          <Field label={copy.nodeAccess.blockIdentity}>
            <input
              value={identityInput}
              onChange={(event) => setIdentityInput(event.target.value)}
              className="ui-field-control px-3 py-2 text-sm placeholder:text-white/30"
              placeholder={copy.identityLookup.placeholder}
              title={copy.identityLookup.help}
            />
          </Field>
          <button
            type="submit"
            className="ui-button ui-button-danger"
            disabled={!identityInput.trim() || busy !== null}
          >
            {copy.nodeAccess.block}
          </button>
        </form>
      </NodeAccessSection>

      <NodeAccessSection title={copy.nodeAccess.blockedNodes}>
        {blockList?.blockedNodePeerIds.length ? (
          <div>
            {blockList.blockedNodePeerIds.map((nodePeerId) => (
              <NodeAccessPeerRow
                key={nodePeerId}
                peerId={nodePeerId}
                action={unblockButton({ nodePeerId })}
              />
            ))}
          </div>
        ) : (
          <NodeAccessEmpty text={copy.nodeAccess.blockedNodesEmpty} />
        )}
        <div>
          <div className="ui-section-heading">
            {copy.nodeAccess.connectedNodes}
          </div>
          {blockablePeerIds.length ? (
            blockablePeerIds.map((nodePeerId) => (
              <NodeAccessPeerRow
                key={nodePeerId}
                peerId={nodePeerId}
                action={
                  <button
                    type="button"
                    className="ui-button ui-button-danger"
                    disabled={busy !== null}
                    onClick={() =>
                      change('block-node', async () => ({ nodePeerId }), true)
                    }
                  >
                    {copy.nodeAccess.block}
                  </button>
                }
              />
            ))
          ) : (
            <NodeAccessEmpty text={copy.nodeAccess.connectedNodesEmpty} />
          )}
        </div>
        <form
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
          onSubmit={blockPeer}
        >
          <Field label={copy.nodeAccess.nodePeerLabel}>
            <input
              value={peerInput}
              onChange={(event) => setPeerInput(event.target.value)}
              className="ui-field-control px-3 py-2 font-mono text-sm placeholder:text-white/30"
              placeholder={copy.nodeAccess.nodePeerPlaceholder}
              title={copy.nodeAccess.nodePeerHelp}
            />
          </Field>
          <button
            type="submit"
            className="ui-button ui-button-danger"
            disabled={!peerInput.trim() || busy !== null}
          >
            {copy.nodeAccess.block}
          </button>
        </form>
      </NodeAccessSection>
    </div>
  );
}
