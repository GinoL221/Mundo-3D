import { IFranchiseRepository } from '../../domain/ports/IFranchiseRepository';

export class DeleteFranchiseUseCase {
  constructor(private readonly franchiseRepo: IFranchiseRepository) {}

  async execute(id: number): Promise<boolean> {
    return this.franchiseRepo.delete(id);
  }
}
