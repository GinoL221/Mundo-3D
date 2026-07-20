import { IFranchiseRepository } from '../../domain/ports/IFranchiseRepository';
import { FranchiseDTO } from '../dtos/FranchiseDTO';

export class GetFranchiseByIdUseCase {
  constructor(private readonly franchiseRepo: IFranchiseRepository) {}

  async execute(id: number): Promise<FranchiseDTO> {
    const franchise = await this.franchiseRepo.findById(id);
    if (!franchise) {
      throw new Error('Franchise not found');
    }

    return {
      idFranchise: franchise.idFranchise,
      nameFranchise: franchise.nameFranchise,
    };
  }
}
