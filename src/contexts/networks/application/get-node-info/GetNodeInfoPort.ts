export interface GetNodeInfoPort {
  getInfo(): Promise<{ id: string; owner: string | null }>;
}
