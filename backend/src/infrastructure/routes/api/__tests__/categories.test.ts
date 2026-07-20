import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';

const mockListExecute = jest.fn();
const mockGetByIdExecute = jest.fn();
const mockCreateExecute = jest.fn();
const mockUpdateExecute = jest.fn();
const mockDeleteExecute = jest.fn();

jest.mock('../../../../application/use-cases/ListCategoriesUseCase', () => ({
  ListCategoriesUseCase: jest.fn().mockImplementation(() => ({ execute: mockListExecute })),
}));

jest.mock('../../../../application/use-cases/GetCategoryByIdUseCase', () => ({
  GetCategoryByIdUseCase: jest.fn().mockImplementation(() => ({ execute: mockGetByIdExecute })),
}));

jest.mock('../../../../application/use-cases/CreateCategoryUseCase', () => ({
  CreateCategoryUseCase: jest.fn().mockImplementation(() => ({ execute: mockCreateExecute })),
}));

jest.mock('../../../../application/use-cases/UpdateCategoryUseCase', () => ({
  UpdateCategoryUseCase: jest.fn().mockImplementation(() => ({ execute: mockUpdateExecute })),
}));

jest.mock('../../../../application/use-cases/DeleteCategoryUseCase', () => ({
  DeleteCategoryUseCase: jest.fn().mockImplementation(() => ({ execute: mockDeleteExecute })),
}));

import errorHandler from '../../../middlewares/errorHandler';
import { getJwtSecret } from '../../../security/JwtSecret';
import { Role } from '../../../../domain/Role';

const JWT_SECRET = getJwtSecret();

// Integration-level guard-matrix + CRUD test for the category routes
// (category-franchise-api PR2). Exercises the real Express pipeline —
// apiAuthMiddleware → requireRoles/adminGuard → validators → controller —
// with only the use-case classes mocked at the module boundary, so it never
// touches a real database (mirrors routes/api/__tests__/products.test.ts).
const buildApp = (): Express => {
  const categoriesRouter = require('../categories').default;
  const app = express();
  app.use(express.json());
  app.use('/api', categoriesRouter);
  app.use(errorHandler);
  return app;
};

const signToken = (idRole: number) =>
  jwt.sign({ userId: 1, email: 'principal@test.com', category: 'test', idRole }, JWT_SECRET, {
    expiresIn: '1h',
  });

const adminToken = signToken(Role.ADMIN);
const staffToken = signToken(Role.STAFF);
const userToken = signToken(Role.USER);

describe('api/categories routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  describe('GET /api/categories', () => {
    it('returns 200 with the category list without an Authorization header (open read)', async () => {
      const mockResult = [
        { idCategory: 1, nameCategory: 'Action Figures' },
        { idCategory: 2, nameCategory: 'Vehicles' },
      ];
      mockListExecute.mockResolvedValue(mockResult);

      const res = await request(app).get('/api/categories');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResult);
      expect(mockListExecute).toHaveBeenCalled();
    });
  });

  describe('GET /api/categories/:id', () => {
    it('returns 200 with the matching category without an Authorization header (open read)', async () => {
      const mockCategory = { idCategory: 1, nameCategory: 'Action Figures' };
      mockGetByIdExecute.mockResolvedValue(mockCategory);

      const res = await request(app).get('/api/categories/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockCategory);
      expect(mockGetByIdExecute).toHaveBeenCalledWith(1);
    });

    it('returns 404 when the category does not exist', async () => {
      mockGetByIdExecute.mockRejectedValue(new Error('Category not found'));

      const res = await request(app).get('/api/categories/999');

      expect(res.status).toBe(404);
    });

    it('returns 400 when :id is not numeric', async () => {
      const res = await request(app).get('/api/categories/not-a-number');

      expect(res.status).toBe(400);
      expect(mockGetByIdExecute).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/categories', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await request(app)
        .post('/api/categories')
        .send({ nameCategory: 'Action Figures' });

      expect(res.status).toBe(401);
      expect(mockCreateExecute).not.toHaveBeenCalled();
    });

    it('returns 401 with a bad/malformed Bearer token', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', 'Bearer not-a-real-token')
        .send({ nameCategory: 'Action Figures' });

      expect(res.status).toBe(401);
      expect(mockCreateExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for an authenticated USER (not in the create allow-list)', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ nameCategory: 'Action Figures' });

      expect(res.status).toBe(403);
      expect(mockCreateExecute).not.toHaveBeenCalled();
    });

    it('returns 201 for STAFF with a valid nameCategory', async () => {
      mockCreateExecute.mockResolvedValue({ idCategory: 1, nameCategory: 'Action Figures' });

      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ nameCategory: 'Action Figures' });

      expect(res.status).toBe(201);
      expect(mockCreateExecute).toHaveBeenCalledWith({ nameCategory: 'Action Figures' });
    });

    it('returns 201 for ADMIN with a valid nameCategory', async () => {
      mockCreateExecute.mockResolvedValue({ idCategory: 1, nameCategory: 'Action Figures' });

      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nameCategory: 'Action Figures' });

      expect(res.status).toBe(201);
      expect(mockCreateExecute).toHaveBeenCalledWith({ nameCategory: 'Action Figures' });
    });

    it('returns 400 when nameCategory is missing', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(mockCreateExecute).not.toHaveBeenCalled();
    });

    it('returns 400 when nameCategory is whitespace-only', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nameCategory: '   ' });

      expect(res.status).toBe(400);
      expect(mockCreateExecute).not.toHaveBeenCalled();
    });

    it('returns the stable duplicate conflict for an existing category name', async () => {
      const categories = [{ idCategory: 1, nameCategory: 'Existing Category' }];
      const before = structuredClone(categories);
      mockCreateExecute.mockImplementation(async ({ nameCategory }) => {
        if (categories.some((category) => category.nameCategory === nameCategory)) {
          throw new Error('DUPLICATE_CATEGORY_NAME');
        }
        const created = { idCategory: categories.length + 1, nameCategory };
        categories.push(created);
        return created;
      });

      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nameCategory: 'Existing Category' });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'DUPLICATE_CATEGORY_NAME' });
      expect(categories).toEqual(before);
    });
  });

  describe('PUT /api/categories/:id', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await request(app)
        .put('/api/categories/1')
        .send({ nameCategory: 'Updated Name' });

      expect(res.status).toBe(401);
      expect(mockUpdateExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for an authenticated USER (not in the update allow-list)', async () => {
      const res = await request(app)
        .put('/api/categories/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ nameCategory: 'Updated Name' });

      expect(res.status).toBe(403);
      expect(mockUpdateExecute).not.toHaveBeenCalled();
    });

    it('returns 200 for STAFF', async () => {
      mockUpdateExecute.mockResolvedValue({ idCategory: 1, nameCategory: 'Updated Name' });

      const res = await request(app)
        .put('/api/categories/1')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ nameCategory: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(mockUpdateExecute).toHaveBeenCalledWith(1, { nameCategory: 'Updated Name' });
    });

    it('returns 200 for ADMIN', async () => {
      mockUpdateExecute.mockResolvedValue({ idCategory: 1, nameCategory: 'Updated Name' });

      const res = await request(app)
        .put('/api/categories/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nameCategory: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(mockUpdateExecute).toHaveBeenCalledWith(1, { nameCategory: 'Updated Name' });
    });

    it('returns 404 when the category does not exist', async () => {
      mockUpdateExecute.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/categories/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nameCategory: 'Updated Name' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when nameCategory is missing', async () => {
      const res = await request(app)
        .put('/api/categories/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(mockUpdateExecute).not.toHaveBeenCalled();
    });

    it('returns the stable duplicate conflict without updating the target category', async () => {
      const categories = [
        { idCategory: 1, nameCategory: 'Target Category' },
        { idCategory: 2, nameCategory: 'Existing Category' },
      ];
      const before = structuredClone(categories);
      mockUpdateExecute.mockImplementation(async (id, { nameCategory }) => {
        const target = categories.find((category) => category.idCategory === id);
        if (!target) return null;
        if (
          categories.some(
            (category) => category.idCategory !== id && category.nameCategory === nameCategory,
          )
        ) {
          throw new Error('DUPLICATE_CATEGORY_NAME');
        }
        target.nameCategory = nameCategory;
        return target;
      });

      const res = await request(app)
        .put('/api/categories/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nameCategory: 'Existing Category' });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'DUPLICATE_CATEGORY_NAME' });
      expect(categories).toEqual(before);
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await request(app).delete('/api/categories/1');

      expect(res.status).toBe(401);
      expect(mockDeleteExecute).not.toHaveBeenCalled();
    });

    it('returns 403 for STAFF (delete is ADMIN-only)', async () => {
      const res = await request(app)
        .delete('/api/categories/1')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
      expect(mockDeleteExecute).not.toHaveBeenCalled();
    });

    it('returns 204 for ADMIN', async () => {
      mockDeleteExecute.mockResolvedValue(true);

      const res = await request(app)
        .delete('/api/categories/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
      expect(mockDeleteExecute).toHaveBeenCalledWith(1);
    });

    it('returns 404 when the category does not exist', async () => {
      mockDeleteExecute.mockResolvedValue(false);

      const res = await request(app)
        .delete('/api/categories/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 409 when the category is referenced by existing products', async () => {
      mockDeleteExecute.mockRejectedValue(new Error('Category has associated products'));

      const res = await request(app)
        .delete('/api/categories/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
    });
  });
});
