export const customCommissionRequestOpenapiSchemas = {
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
};
