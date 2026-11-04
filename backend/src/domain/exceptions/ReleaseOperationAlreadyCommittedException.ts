/** Raised when storage already holds a committed release for the same slot and attempt. */
export class ReleaseOperationAlreadyCommittedException extends Error {
  constructor(
    readonly slotId: string,
    readonly attemptId: string,
  ) {
    super(`A release was already committed for slot ${slotId} and attempt ${attemptId}`);
    this.name = 'ReleaseOperationAlreadyCommittedException';
  }
}
