/**
 * A request that never reached the node: `fetch` rejected with a TypeError,
 * as it does when the connection is refused or drops. It stays a TypeError, so
 * the network-failure handling that reads one keeps working, while a TypeError
 * thrown by other code is never mistaken for an unreachable node.
 */
export class HttpConnectionError extends TypeError {
  public constructor(public readonly cause: TypeError) {
    super(cause.message);
    this.name = HttpConnectionError.name;
  }
}
