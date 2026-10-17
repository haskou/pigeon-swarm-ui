/** Stored form of an `MlsUpdateCadence`. */
export interface MlsUpdateCadencePrimitives {
  /** When this device last took fresh leaf keys in the group. */
  readonly lastPathCommitAt: number;
  /** The first epoch of the group those keys are in, as a decimal. */
  readonly keyEpoch: string;
  /** The random delay added to the interval, in milliseconds. */
  readonly jitterMs: number;
  /** The application messages this device sent in the group since. */
  readonly sentSinceUpdate: number;
}
