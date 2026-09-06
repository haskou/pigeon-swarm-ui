import type { SelectedClientNode } from './SelectedClientNode';

import { ClientNodeSelection } from './ClientNodeSelection';

let selectedNode: SelectedClientNode | undefined;

export function clientNodeForDocument(): SelectedClientNode | undefined {
  try {
    selectedNode ??= new ClientNodeSelection(window.localStorage).read();
  } catch {
    return undefined;
  }

  return selectedNode;
}
