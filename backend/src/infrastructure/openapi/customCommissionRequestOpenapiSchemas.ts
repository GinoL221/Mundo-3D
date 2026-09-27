// Custom commission request schemas, kept separate to keep openapiSchemas.ts below the source-file limit.

const customCommissionRequestInputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    email: { type: 'string', format: 'email', maxLength: 254 },
    idea: { type: 'string', minLength: 1, maxLength: 5000 },
    idProduct: { type: 'integer', minimum: 1, nullable: true },
  },
  required: ['name', 'email', 'idea'],
};

const customCommissionRequestSchema = {
  type: 'object',
  properties: {
    idCustomCommissionRequest: { type: 'integer' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    idea: { type: 'string' },
    idProduct: { type: 'integer', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    expiresAt: { type: 'string', format: 'date-time' },
  },
  required: ['idCustomCommissionRequest', 'name', 'email', 'idea', 'idProduct', 'createdAt', 'expiresAt'],
};

const customCommissionRequestReceiptSchema = {
  type: 'object',
  properties: {
    idCustomCommissionRequest: { type: 'integer' },
    createdAt: { type: 'string', format: 'date-time' },
    expiresAt: { type: 'string', format: 'date-time' },
  },
  required: ['idCustomCommissionRequest', 'createdAt', 'expiresAt'],
};

export const customCommissionRequestOpenapiSchemas = {
  CustomCommissionRequestInput: customCommissionRequestInputSchema,
  CustomCommissionRequest: customCommissionRequestSchema,
  CustomCommissionRequestReceipt: customCommissionRequestReceiptSchema,
};
