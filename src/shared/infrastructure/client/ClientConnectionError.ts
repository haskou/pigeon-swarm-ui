export class ClientConnectionError extends Error {
  public constructor(public readonly code: 'incompatible' | 'unreachable') {
    super(
      code === 'incompatible'
        ? 'This node is not compatible with this client.'
        : 'The node could not be reached securely.',
    );
  }
}
