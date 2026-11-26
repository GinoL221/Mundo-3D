export interface DemoSandboxResetPort {
  reset(slotId: string, generation: number, resetAttemptId: string): Promise<void>;
  verify(slotId: string, generation: number, resetAttemptId: string): Promise<boolean>;
  /** Advances the slot fence to `completedGeneration + 1` after control-plane reset completion. */
  releaseFence?(slotId: string, completedGeneration: number, resetAttemptId: string): Promise<void>;
}
