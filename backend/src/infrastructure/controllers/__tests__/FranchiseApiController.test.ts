import { NextFunction, Request, Response } from 'express';
import { FranchiseApiController } from '../FranchiseApiController';
import { ListFranchisesUseCase } from '../../../application/use-cases/ListFranchisesUseCase';
import { GetFranchiseByIdUseCase } from '../../../application/use-cases/GetFranchiseByIdUseCase';
import { CreateFranchiseUseCase } from '../../../application/use-cases/CreateFranchiseUseCase';
import { UpdateFranchiseUseCase } from '../../../application/use-cases/UpdateFranchiseUseCase';
import { DeleteFranchiseUseCase } from '../../../application/use-cases/DeleteFranchiseUseCase';

describe('FranchiseApiController', () => {
  let controller: FranchiseApiController;
  let list: jest.Mocked<ListFranchisesUseCase>;
  let getById: jest.Mocked<GetFranchiseByIdUseCase>;
  let create: jest.Mocked<CreateFranchiseUseCase>;
  let update: jest.Mocked<UpdateFranchiseUseCase>;
  let destroy: jest.Mocked<DeleteFranchiseUseCase>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    list = { execute: jest.fn() } as any;
    getById = { execute: jest.fn() } as any;
    create = { execute: jest.fn() } as any;
    update = { execute: jest.fn() } as any;
    destroy = { execute: jest.fn() } as any;
    controller = new FranchiseApiController(list, getById, create, update, destroy);
    req = { params: {}, body: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
    next = jest.fn();
  });

  it('returns the plain franchise list and forwards list failures', async () => {
    const franchises = [{ idFranchise: 1, nameFranchise: 'Studio Ghibli' }];
    list.execute.mockResolvedValueOnce(franchises).mockRejectedValueOnce(new Error('DB is down'));

    await controller.index(req as Request, res as Response, next);
    expect(res.json).toHaveBeenCalledWith(franchises);

    await controller.index(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'DB is down' }));
  });

  it('shows a franchise, maps a miss to 404, and rejects non-numeric ids', async () => {
    req.params = { id: '1' };
    const franchise = { idFranchise: 1, nameFranchise: 'Studio Ghibli' };
    getById.execute
      .mockResolvedValueOnce(franchise)
      .mockRejectedValueOnce(new Error('Franchise not found'));

    await controller.show(req as Request, res as Response, next);
    expect(res.json).toHaveBeenCalledWith(franchise);

    await controller.show(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(404);

    req.params = { id: 'invalid' };
    await controller.show(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(getById.execute).toHaveBeenCalledTimes(2);
  });

  it('creates a franchise and forwards creation failures', async () => {
    req.body = { nameFranchise: 'Studio Ghibli' };
    const franchise = { idFranchise: 1, nameFranchise: 'Studio Ghibli' };
    create.execute.mockResolvedValueOnce(franchise).mockRejectedValueOnce(new Error('DB is down'));

    await controller.create(req as Request, res as Response, next);
    expect(create.execute).toHaveBeenCalledWith({ nameFranchise: 'Studio Ghibli' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(franchise);

    await controller.create(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'DB is down' }));
  });

  it('updates a franchise, maps a miss to 404, and rejects non-numeric ids', async () => {
    req.params = { id: '1' };
    req.body = { nameFranchise: 'Updated' };
    update.execute
      .mockResolvedValueOnce({ idFranchise: 1, nameFranchise: 'Updated' })
      .mockResolvedValueOnce(null);

    await controller.update(req as Request, res as Response, next);
    expect(update.execute).toHaveBeenCalledWith(1, { nameFranchise: 'Updated' });
    expect(res.json).toHaveBeenCalledWith({ idFranchise: 1, nameFranchise: 'Updated' });

    await controller.update(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(404);

    req.params = { id: 'invalid' };
    await controller.update(req as Request, res as Response, next);
    expect(update.execute).toHaveBeenCalledTimes(2);
  });

  it('deletes, maps missing and referenced franchises, and rejects non-numeric ids', async () => {
    req.params = { id: '1' };
    destroy.execute
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('Franchise has associated products'));

    await controller.destroy(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(204);

    await controller.destroy(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(404);

    await controller.destroy(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No se puede eliminar la franquicia porque tiene productos asociados',
    });

    req.params = { id: 'invalid' };
    await controller.destroy(req as Request, res as Response, next);
    expect(destroy.execute).toHaveBeenCalledTimes(3);
  });
});
