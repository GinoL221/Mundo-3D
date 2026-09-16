import { FranchiseRepositoryPort } from '../../domain/ports/FranchiseRepositoryPort';

export class DeleteFranchiseUseCase {
  constructor(private readonly franchiseRepo: FranchiseRepositoryPort) {}

  async execute(id: number): Promise<boolean> {
    return this.franchiseRepo.delete(id);
  }
}
