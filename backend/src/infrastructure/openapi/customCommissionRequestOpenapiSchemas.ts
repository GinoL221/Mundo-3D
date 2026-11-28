export const customCommissionRequestOpenapiSchemas = {
  CustomCommissionRequestInput: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      email: { type: 'string', format: 'email', maxLength: 254 },
      phone: { type: 'string', maxLength: 30, nullable: true },
      idea: { type: 'string', minLength: 1, maxLength: 5000 },
      idProduct: { type: 'integer', minimum: 1, nullable: true },
    },
    required: ['name', 'email', 'idea'],
  },
  CustomCommissionRequest: {
    type: 'object',
    properties: {
      idCustomCommissionRequest: { type: 'integer' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', nullable: true },
      idea: { type: 'string' },
      idProduct: { type: 'integer', nullable: true },
      idUser: { type: 'integer', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      expiresAt: { type: 'string', format: 'date-time' },
    },
    required: [
      'idCustomCommissionRequest',
      'name',
      'email',
      'phone',
      'idea',
      'idProduct',
      'idUser',
      'createdAt',
      'expiresAt',
    ],
  },
  CustomCommissionRequestReceipt: {
    type: 'object',
    properties: {
      idCustomCommissionRequest: { type: 'integer' },
      createdAt: { type: 'string', format: 'date-time' },
      expiresAt: { type: 'string', format: 'date-time' },
    },
    required: ['idCustomCommissionRequest', 'createdAt', 'expiresAt'],
  },
};
