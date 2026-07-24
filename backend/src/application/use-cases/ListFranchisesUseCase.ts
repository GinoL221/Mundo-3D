import { FranchiseRepositoryPort } from '../../domain/ports/FranchiseRepositoryPort';
import { FranchiseDTO } from '../dtos/FranchiseDTO';

export class ListFranchisesUseCase {
  constructor(private readonly franchiseRepo: FranchiseRepositoryPort) {}

  async execute(): Promise<FranchiseDTO[]> {
    const franchises = await this.franchiseRepo.findAll();
    return franchises.map((franchise) => ({
      idFranchise: franchise.idFranchise,
      nameFranchise: franchise.nameFranchise,
    }));
  }
}
