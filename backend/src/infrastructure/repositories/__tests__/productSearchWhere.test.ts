import { Op } from 'sequelize';
import { buildProductSearchWhere, escapeLikePattern } from '../productSearchWhere';

describe('escapeLikePattern', () => {
  it('escapes %, _ and \\ so they match literally in a LIKE pattern', () => {
    expect(escapeLikePattern('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });

  it('leaves a term with no special characters untouched', () => {
    expect(escapeLikePattern('goku')).toBe('goku');
  });
});

describe('buildProductSearchWhere', () => {
  it('returns an empty where clause when no filters are supplied', () => {
    expect(buildProductSearchWhere({})).toEqual({});
  });

  it('wraps a search term in Op.or across name_product and description_product', () => {
    const where = buildProductSearchWhere({ search: 'goku' });

    expect(where).toEqual({
      [Op.and]: [
        {
          [Op.or]: [
            { nameProduct: { [Op.like]: '%goku%' } },
            { descriptionProduct: { [Op.like]: '%goku%' } },
          ],
        },
      ],
    });
  });

  it('AND-combines search, idCategory, and idFranchise when all are supplied', () => {
    const where = buildProductSearchWhere({ search: 'goku', idCategory: 3, idFranchise: 5 }) as Record<
      symbol,
      unknown[]
    >;
    const andConditions = where[Op.and];

    expect(andConditions).toHaveLength(3);
    expect(andConditions).toContainEqual({ idCategory: 3 });
    expect(andConditions).toContainEqual({ idFranchise: 5 });
  });

  it('applies only idCategory when search and idFranchise are absent', () => {
    expect(buildProductSearchWhere({ idCategory: 3 })).toEqual({ [Op.and]: [{ idCategory: 3 }] });
  });

  it('applies only idFranchise when search and idCategory are absent', () => {
    expect(buildProductSearchWhere({ idFranchise: 5 })).toEqual({ [Op.and]: [{ idFranchise: 5 }] });
  });
});
