import type { IdentityAdmissionProgress } from './IdentityAdmissionProgress';

export type IdentityAdmissionProgressListener = (
  progress: IdentityAdmissionProgress,
) => void;
