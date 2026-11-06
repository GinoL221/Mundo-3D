import { DemoSandboxLeasePolicy } from '../../domain/entities/DemoSandboxSlot';
import { DemoSandboxSlotRepositoryPort } from '../../domain/ports/DemoSandboxSlotRepositoryPort';
import { DemoSandboxClockPort } from '../../domain/ports/DemoSandboxRuntimePorts';

export class ValidateDemoSandboxLeaseUseCase {
  constructor(
    private readonly repository: DemoSandboxSlotRepositoryPort,
    private readonly policy: DemoSandboxLeasePolicy,
    private readonly clock: DemoSandboxClockPort,
  ) {}

  execute(leaseId: string) {
    return this.repository.recordLeaseActivity(leaseId, this.clock, this.policy);
  }
}
