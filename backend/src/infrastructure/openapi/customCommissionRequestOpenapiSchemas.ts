export const customCommissionRequestOpenapiSchemas = {
  CustomCommissionRequestInput: {
    type: 'object', additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      email: { type: 'string', format: 'email', maxLength: 254 },
      idea: { type: 'string', minLength: 1, maxLength: 5000 },
      idProduct: { type: 'integer', minimum: 1, nullable: true },
    }, required: ['name', 'email', 'idea'],
  },
  CustomCommissionRequest: {
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
    required: [
      'idCustomCommissionRequest',
      'name',
      'email',
      'idea',
      'idProduct',
      'createdAt',
      'expiresAt',
    ],
  },
  CustomCommissionRequestReceipt: {
    type: 'object', properties: {
      idCustomCommissionRequest: { type: 'integer' },
      createdAt: { type: 'string', format: 'date-time' },
      expiresAt: { type: 'string', format: 'date-time' },
    }, required: ['idCustomCommissionRequest', 'createdAt', 'expiresAt'],
  },
};
