import { CustomCommissionRequestRepositoryPort } from '../../domain/ports/CustomCommissionRequestRepositoryPort';

export class PurgeExpiredCommissionRequestsUseCase {
  constructor(
    private readonly repository: CustomCommissionRequestRepositoryPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<number> {
    return this.repository.purgeExpired(this.clock());
  }
}
