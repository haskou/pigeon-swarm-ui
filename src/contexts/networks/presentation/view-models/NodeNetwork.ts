export type NodeNetwork = {
  id: string;
  key?: null | string;
  name: string;
  /**
   * The node's private flag. The node sends it only for signed list requests.
   * Absent means unknown, so the network is not offered for private placement.
   */
  privateNetwork?: boolean;
};
