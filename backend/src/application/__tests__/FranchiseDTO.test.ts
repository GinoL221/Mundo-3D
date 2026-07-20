import type { FranchiseDTO } from '../dtos/FranchiseDTO';

describe('FranchiseDTO', () => {
  it('describes the franchise identifier and name returned by the application layer', () => {
    const dto: FranchiseDTO = { idFranchise: 7, nameFranchise: 'Studio Ghibli' };

    expect(dto).toEqual({ idFranchise: 7, nameFranchise: 'Studio Ghibli' });
  });
});
