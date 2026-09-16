import { FranchiseRepositoryPort } from '../../domain/ports/FranchiseRepositoryPort';
import { FranchiseDTO } from '../dtos/FranchiseDTO';

export interface CreateFranchiseInput {
  nameFranchise: string;
}

export class CreateFranchiseUseCase {
  constructor(private readonly franchiseRepo: FranchiseRepositoryPort) {}

  async execute(input: CreateFranchiseInput): Promise<FranchiseDTO> {
    const created = await this.franchiseRepo.create({
      nameFranchise: input.nameFranchise,
    });

    return {
      idFranchise: created.idFranchise,
      nameFranchise: created.nameFranchise,
    };
  }
}
