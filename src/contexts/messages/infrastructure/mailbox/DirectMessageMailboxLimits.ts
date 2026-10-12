/** Bounds shared by the direct mailbox collaborators. */
export class DirectMessageMailboxLimits {
  public static readonly PAGE_SIZE = 50;
  public static readonly READ_PAGE_LIMIT = 4;
  public static readonly OWN_COPY_LIMIT = 512;
  public static readonly OPEN_RETRY_MS = 60_000;
}
