import { FranchiseRepositoryPort } from '../../domain/ports/FranchiseRepositoryPort';
import { FranchiseDTO } from '../dtos/FranchiseDTO';

export interface UpdateFranchiseInput {
  nameFranchise?: string;
}

export class UpdateFranchiseUseCase {
  constructor(private readonly franchiseRepo: FranchiseRepositoryPort) {}

  async execute(id: number, input: UpdateFranchiseInput): Promise<FranchiseDTO | null> {
    const updated = await this.franchiseRepo.update(id, input);
    if (!updated) {
      return null;
    }

    return {
      idFranchise: updated.idFranchise,
      nameFranchise: updated.nameFranchise,
    };
  }
}
