import { CustomCommissionRequest } from '../../domain/entities/CustomCommissionRequest';
import { CustomCommissionRequestRepositoryPort } from '../../domain/ports/CustomCommissionRequestRepositoryPort';

export class ListMyCustomCommissionRequestsUseCase {
  constructor(
    private readonly repository: CustomCommissionRequestRepositoryPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(idUser: number): Promise<CustomCommissionRequest[]> {
    return this.repository.listActiveByUser(idUser, this.clock());
  }
}
