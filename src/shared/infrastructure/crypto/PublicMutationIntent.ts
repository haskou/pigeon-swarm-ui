export interface PublicMutationIntent {
  kind: 'delete' | 'put';
  payload: Record<string, unknown>;
  recordId: string;
  store: string;
}
