/**
 * Why the signed transitions authorize the publisher of a device-sealed
 * secret: as a device the entry revision and every later state authorize, or
 * as the device that retired itself into that revision with a hand-over.
 */
export type DeviceSealedSecretPublisherStanding = 'authorized' | 'retired';
