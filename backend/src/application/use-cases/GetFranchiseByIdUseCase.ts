import { FranchiseRepositoryPort } from '../../domain/ports/FranchiseRepositoryPort';
import { FranchiseDTO } from '../dtos/FranchiseDTO';

export class GetFranchiseByIdUseCase {
  constructor(private readonly franchiseRepo: FranchiseRepositoryPort) {}

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
