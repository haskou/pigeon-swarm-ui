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

/**
 * Switches this document to another node without a reload. Only valid before
 * the application modules load, because they read the node once.
 */
export async function selectClientNodeForDocument(
  endpoint: string,
): Promise<SelectedClientNode> {
  selectedNode = await new ClientNodeSelection(window.localStorage).save(
    endpoint,
  );

  return selectedNode;
}
