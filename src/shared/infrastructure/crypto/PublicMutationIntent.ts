export interface PublicMutationIntent {
  /** Scope frontier signed into a community or conversation record. */
  frontier?: string[];
  kind: 'delete' | 'put';
  payload: Record<string, unknown>;
  recordId: string;
  store: string;
}
