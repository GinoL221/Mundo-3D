import { Op, WhereOptions } from 'sequelize';
import { ProductSearchOptions } from '../../domain/ports/ProductRepositoryPort';

// Sequelize parameterizes the LIKE *value* but does not escape LIKE
// wildcards — an unescaped `%` would silently match everything. Escapes
// `\`, `%` and `_` in one pass (so the backslash case is handled before
// the wildcards it would otherwise re-escape). MySQL's default LIKE
// escape character is `\`, so no ESCAPE clause is needed.
export const escapeLikePattern = (term: string): string => term.replace(/[\\%_]/g, (ch) => `\\${ch}`);

// Builds the `WHERE` clause for `SequelizeProductRepository.searchPaged`:
// search (Op.or across name_product/description_product) AND idCategory
// AND idFranchise, each present only when supplied. Extracted out of the
// repository into its own module to keep that file under the project's
// 250-line-per-file cap (see AGENTS.md).
export function buildProductSearchWhere({
  search,
  idCategory,
  idFranchise,
}: Pick<ProductSearchOptions, 'search' | 'idCategory' | 'idFranchise'>): WhereOptions {
  const conditions: WhereOptions[] = [];

  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    conditions.push({
      [Op.or]: [
        { nameProduct: { [Op.like]: pattern } },
        { descriptionProduct: { [Op.like]: pattern } },
      ],
    });
  }
  if (idCategory !== undefined) conditions.push({ idCategory });
  if (idFranchise !== undefined) conditions.push({ idFranchise });

  return conditions.length > 0 ? { [Op.and]: conditions } : {};
}
