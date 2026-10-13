declare const __PIGEON_MAILBOX_AVAILABILITY_SERVERS__: string;

/** Comma-separated availability server bases, from the build config. */
export const MAILBOX_AVAILABILITY_SERVERS =
  typeof __PIGEON_MAILBOX_AVAILABILITY_SERVERS__ === 'string'
    ? __PIGEON_MAILBOX_AVAILABILITY_SERVERS__
    : '';
