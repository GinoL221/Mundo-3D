// `@openapi` annotation for `GET /products/search` (product-catalog-search
// spec), split out of `products.ts` purely to keep that file under
// AGENTS.md's 250-line-per-source-file cap — mirrors the `productSearchWhere.ts`
// extraction precedent from Work Unit 1. `swagger-jsdoc`'s glob
// (`routes/api/*.ts`, see `openapi/openapiSpec.ts`) scans every file directly
// in this folder for `@openapi` comment blocks regardless of whether it is
// imported anywhere, so this file needs no runtime wiring — the empty export
// only makes it a valid ES module for the TypeScript compiler.
/**
 * @openapi
 * /products/search:
 *   get:
 *     summary: Search and filter products, paginated (public)
 *     description: >
 *       Public, paginated product search-and-filter (product-catalog-search
 *       spec). Combines `search`, `idCategory`, `idFranchise` with AND
 *       semantics; `search` matches case-insensitively as a substring
 *       against `name_product` OR `description_product`. No matches, an
 *       empty search term, or a well-formed filter matching nothing is a 200
 *       with an empty page, never a 404. Independent of `GET /products` and
 *       its pagination constants.
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Case-insensitive substring match on name or description.
 *       - in: query
 *         name: idCategory
 *         schema: { type: integer }
 *       - in: query
 *         name: idFranchise
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
 *     responses:
 *       '200':
 *         description: Paginated page of matching products.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *                 total: { type: integer }
 *                 totalPages: { type: integer }
 *       '400':
 *         description: Invalid pagination (INVALID_PAGINATION) or filter id (INVALID_FILTER).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorWithCode' }
 */
export {};
