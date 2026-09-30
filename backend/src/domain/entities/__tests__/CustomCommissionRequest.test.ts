import { CustomCommissionRequest } from '../CustomCommissionRequest';

describe('CustomCommissionRequest', () => {
  it('stores contact, idea, optional product reference and expiration', () => {
    const createdAt = new Date('2026-09-01T12:00:00.000Z');
    const expiresAt = new Date('2026-10-01T12:00:00.000Z');
    const request = new CustomCommissionRequest(1, 'Ari', 'ari@example.com', 'A dragon', 7, createdAt, expiresAt);
    expect(request).toMatchObject({ idCustomCommissionRequest: 1, name: 'Ari', email: 'ari@example.com', idea: 'A dragon', idProduct: 7, createdAt, expiresAt });
  });

  it('allows a request without a product', () => {
    const request = new CustomCommissionRequest(1, 'Ari', 'ari@example.com', 'A dragon', null, new Date(), new Date());
    expect(request.idProduct).toBeNull();
  });
});
