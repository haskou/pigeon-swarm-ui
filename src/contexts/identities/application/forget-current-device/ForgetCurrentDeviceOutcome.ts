export type ForgetCurrentDeviceOutcome =
  | 'forgotten'
  | 'only-device'
  | 'revoke-failed'
  | 'unlock-failed';
