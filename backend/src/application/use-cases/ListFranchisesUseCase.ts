import { IFranchiseRepository } from '../../domain/ports/IFranchiseRepository';
import { FranchiseDTO } from '../dtos/FranchiseDTO';

export class ListFranchisesUseCase {
  constructor(private readonly franchiseRepo: IFranchiseRepository) {}

  async execute(): Promise<FranchiseDTO[]> {
    const franchises = await this.franchiseRepo.findAll();
    return franchises.map((franchise) => ({
      idFranchise: franchise.idFranchise,
      nameFranchise: franchise.nameFranchise,
    }));
  }
}
