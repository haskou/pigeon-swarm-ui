export type NodeRelayPortCheckTarget = {
  id: string;
  label: string;
  port: number;
  protocol: 'tcp' | 'udp';
};
