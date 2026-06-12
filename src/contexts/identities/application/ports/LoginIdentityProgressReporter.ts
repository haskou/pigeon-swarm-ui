import type { LoginIdentityProgressStep } from './LoginIdentityProgressStep';

export type LoginIdentityProgressReporter = (
  step: LoginIdentityProgressStep,
) => void;
