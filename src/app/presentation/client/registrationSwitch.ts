import type { PendingRegistrationLink } from '../../../contexts/nodeAccess/presentation/view-models/registrationLink';
import type { SelectedClientNode } from '../../../shared/infrastructure/client/SelectedClientNode';

/** A registration link's node that the user must confirm before using it. */
export type RegistrationSwitch = {
  /** The node this browser uses now, or null when none is chosen yet. */
  current: null | string;
  node: string;
};

/**
 * A link from anyone may name any node, so this browser asks before it
 * adopts the link's node, even when no node is chosen yet.
 */
export function registrationSwitchFor(
  registration: null | PendingRegistrationLink,
  choosing: boolean,
  selected: Pick<SelectedClientNode, 'url'> | undefined,
): null | RegistrationSwitch {
  if (!registration || choosing || registration.node === selected?.url)
    return null;

  return { current: selected?.url ?? null, node: registration.node };
}
