import { ForeignKeyConstraintError, Op } from 'sequelize';
import db from '../../../database/models/db';
import { SequelizeCustomCommissionRequestRepository } from '../SequelizeCustomCommissionRequestRepository';
import { SelectedProductNotFoundException } from '../../../domain/exceptions/SelectedProductNotFoundException';

describe('SequelizeCustomCommissionRequestRepository', () => {
  const repository = new SequelizeCustomCommissionRequestRepository();

  const model = db.CustomCommissionRequest as any;
  const originals = { create: model.create, findAll: model.findAll, destroy: model.destroy };
  beforeEach(() => {
    model.create = jest.fn();
    model.findAll = jest.fn();
    model.destroy = jest.fn();
  });
  afterAll(() => Object.assign(model, originals));

  it('creates and maps a request', async () => {
    const createdAt = new Date('2026-09-01T00:00:00Z');
    const expiresAt = new Date('2026-10-01T00:00:00Z');
    jest.mocked(db.CustomCommissionRequest.create).mockResolvedValue({
      idCustomCommissionRequest: 8, name: 'Ari', email: 'ari@example.com', idea: 'Dragon', idProduct: null, createdAt, expiresAt,
    } as any);
    const result = await repository.create({ name: 'Ari', email: 'ari@example.com', idea: 'Dragon', idProduct: null, createdAt, expiresAt });
    expect(result.idCustomCommissionRequest).toBe(8);
    expect(db.CustomCommissionRequest.create).toHaveBeenCalledWith(expect.objectContaining({ idProduct: null, expiresAt }));
  });

  it('lists active rows newest-first', async () => {
    jest.mocked(db.CustomCommissionRequest.findAll).mockResolvedValue([] as any);
    await repository.listActive(new Date('2026-10-01T00:00:00Z'));
    expect(db.CustomCommissionRequest.findAll).toHaveBeenCalledWith(expect.objectContaining({ order: [['createdAt', 'DESC']] }));
  });

  it('converts a selected-product foreign-key race into a domain exception', async () => {
    jest.mocked(db.CustomCommissionRequest.create).mockRejectedValue(new ForeignKeyConstraintError({ message: 'fk failure' }));
    await expect(repository.create({ name: 'Ari', email: 'ari@example.com', idea: 'Dragon', idProduct: 44, createdAt: new Date(), expiresAt: new Date() }))
      .rejects.toBeInstanceOf(SelectedProductNotFoundException);
  });

  it('preserves unrelated foreign-key errors when no product was selected', async () => {
    const error = new ForeignKeyConstraintError({ message: 'other fk failure' });
    jest.mocked(db.CustomCommissionRequest.create).mockRejectedValue(error);
    await expect(repository.create({ name: 'Ari', email: 'ari@example.com', idea: 'Dragon', idProduct: null, createdAt: new Date(), expiresAt: new Date() }))
      .rejects.toBe(error);
  });

  it('filters expired rows and physically purges at the exact expiry boundary', async () => {
    const now = new Date('2026-10-01T00:00:00Z');
    jest.mocked(db.CustomCommissionRequest.findAll).mockResolvedValue([] as any);
    jest.mocked(db.CustomCommissionRequest.destroy).mockResolvedValue(3 as any);
    await repository.listActive(now);
    await expect(repository.purgeExpired(now)).resolves.toBe(3);
    expect(db.CustomCommissionRequest.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { expiresAt: { [Op.gt]: now } } }));
    expect(db.CustomCommissionRequest.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { expiresAt: { [Op.lte]: now } } }));
  });
});
