import type { NodeRelayPortCheckResult } from './NodeRelayPortCheckResult';

export type NodeRelayPortCheckResource = {
  checks: NodeRelayPortCheckResult[];
  publicHost: string;
};
