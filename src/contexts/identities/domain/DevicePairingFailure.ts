/**
 * Why a device pairing step was refused. The UI turns the kind into plain
 * copy; the message stays developer-facing and never carries the code itself.
 */
export type DevicePairingFailure = 'expired' | 'invalid' | 'mismatch' | 'used';
