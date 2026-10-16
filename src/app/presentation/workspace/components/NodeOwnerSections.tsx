import type { ReactElement } from 'react';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { NodeSettingsSection } from './NodeSettingsSection';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { NodeBlockSharingPanel } from './NodeBlockSharingPanel';
import { NodeBlocksPanel } from './NodeBlocksPanel';
import { NodeRegistrationPanel } from './NodeRegistrationPanel';

type NodeOwnerSection = Extract<
  NodeSettingsSection,
  'blocks' | 'registration' | 'sharing'
>;

const nodeOwnerPanels: Record<
  NodeOwnerSection,
  (props: { session: Session }) => ReactElement
> = {
  blocks: NodeBlocksPanel,
  registration: NodeRegistrationPanel,
  sharing: NodeBlockSharingPanel,
};

/** The node settings tabs that only the node owner sees. */
export function nodeOwnerSectionTabs(
  isOwner: boolean,
): ReadonlyArray<readonly [NodeSettingsSection, string]> {
  if (!isOwner) return [];

  return [
    ['registration', copy.nodeAccess.registrationTab],
    ['blocks', copy.nodeAccess.blocksTab],
    ['sharing', copy.nodeAccess.sharingTab],
  ];
}

/** Renders the active node owner tab, or nothing for other tabs and users. */
export function NodeOwnerSectionPanel({
  isOwner,
  section,
  session,
}: {
  isOwner: boolean;
  section: NodeSettingsSection;
  session: Session;
}): ReactElement | null {
  if (!isOwner || !(section in nodeOwnerPanels)) return null;

  const Panel = nodeOwnerPanels[section as NodeOwnerSection];

  return <Panel session={session} />;
}
