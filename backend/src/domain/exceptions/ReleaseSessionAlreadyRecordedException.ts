/** Raised when storage already holds a release session record for the same slot and attempt. */
export class ReleaseSessionAlreadyRecordedException extends Error {
  constructor(
    readonly slotId: string,
    readonly attemptId: string,
  ) {
    super(`A release session was already recorded for slot ${slotId} and attempt ${attemptId}`);
    this.name = 'ReleaseSessionAlreadyRecordedException';
  }
}
