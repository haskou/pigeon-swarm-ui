/** A signed removal of this device, verified while it was signed in. */
export type DeviceRemoval = {
  identityId: string;
  state: 'erasing' | 'erased' | 'erase-failed';
};
