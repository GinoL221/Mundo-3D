import { DemoSandboxSlotSnapshot } from '../../domain/entities/DemoSandboxSlot';
import { DemoSandboxLeaseReleasePort } from '../../domain/ports/DemoSandboxSlotRepositoryPort';

export class ReleaseDemoSandboxLeaseUseCase {
  constructor(private readonly repository: DemoSandboxLeaseReleasePort) {}

  execute(slotId: string, leaseId: string): Promise<DemoSandboxSlotSnapshot | null> {
    return this.repository.releaseLease(slotId, leaseId);
  }
}
