import { IFranchiseRepository } from '../../domain/ports/IFranchiseRepository';
import { FranchiseDTO } from '../dtos/FranchiseDTO';

export interface CreateFranchiseInput {
  nameFranchise: string;
}

export class CreateFranchiseUseCase {
  constructor(private readonly franchiseRepo: IFranchiseRepository) {}

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
