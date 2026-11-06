import { DemoSandboxSlotSnapshot } from '../../domain/entities/DemoSandboxSlot';
import { DemoSandboxSlotRepositoryPort } from '../../domain/ports/DemoSandboxSlotRepositoryPort';
import { DemoSandboxClockPort } from '../../domain/ports/DemoSandboxRuntimePorts';

export class ExpireDemoSandboxLeasesUseCase {
  constructor(
    private readonly repository: DemoSandboxSlotRepositoryPort,
    private readonly clock: DemoSandboxClockPort,
  ) {}

  execute(): Promise<DemoSandboxSlotSnapshot[]> {
    return this.repository.expireDueLeases(this.clock.now());
  }
}
