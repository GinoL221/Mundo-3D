export interface DemoSandboxResetPort {
  reset(slotId: string, generation: number, resetAttemptId: string): Promise<void>;
  verify(slotId: string, generation: number, resetAttemptId: string): Promise<boolean>;
}
