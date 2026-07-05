import type { NodeRelayPortCheckTarget } from './NodeRelayPortCheckTarget';

export type NodeRelayPortCheckResult = NodeRelayPortCheckTarget & {
  message?: string;
  status: 'reachable' | 'unreachable' | 'unknown';
};
