import { CustomCommissionRequestRepositoryPort } from '../../domain/ports/CustomCommissionRequestRepositoryPort';
import { CustomCommissionRequest } from '../../domain/entities/CustomCommissionRequest';

export class ListCustomCommissionRequestsUseCase {
  constructor(
    private readonly repository: CustomCommissionRequestRepositoryPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<CustomCommissionRequest[]> {
    return this.repository.listActive(this.clock());
  }
}
