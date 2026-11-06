import { DemoSandboxLeasePolicy } from '../../domain/entities/DemoSandboxSlot';
import { DemoSandboxSlotRepositoryPort } from '../../domain/ports/DemoSandboxSlotRepositoryPort';
import {
  DemoSandboxClockPort,
  DemoSandboxLeaseIdGeneratorPort,
} from '../../domain/ports/DemoSandboxRuntimePorts';

export class AllocateDemoSandboxLeaseUseCase {
  constructor(
    private readonly repository: DemoSandboxSlotRepositoryPort,
    private readonly policy: DemoSandboxLeasePolicy,
    private readonly clock: DemoSandboxClockPort,
    private readonly leaseIds: DemoSandboxLeaseIdGeneratorPort,
  ) {}

  execute() {
    return this.repository.claimAvailableSlot(
      this.leaseIds.next(),
      this.clock.now(),
      this.policy,
    );
  }
}
