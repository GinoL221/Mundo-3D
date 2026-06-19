const { ProductService, UserService } = require('../services');

describe('Error Propagation', () => {
  describe('viewCart error propagation', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should call next(error) when GetCartByUserIdUseCase rejects', async () => {
      const { CartController } = require('../infrastructure/controllers/CartController');

      const mockGetCartByUserIdUseCase = {
        execute: jest.fn().mockRejectedValue(new Error('DB connection failed'))
      };
      const controller = new CartController(mockGetCartByUserIdUseCase);

      const mockReq = { session: { userLogged: { idUser: 1 } } };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        render: jest.fn(),
      };
      const mockNext = jest.fn();

      // Call the controller
      await controller.viewCart(mockReq, mockRes, mockNext);

      // Should call next(error), NOT res.status(500).send()
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.send).not.toHaveBeenCalled();
    });
  });

  describe('getAllProducts error propagation', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should call next(error) when ProductService rejects', async () => {
      jest.spyOn(ProductService, 'findAll').mockRejectedValue(new Error('DB error'));

      // Re-require to get fresh module with mocked service
      jest.resetModules();
      // Re-mock after reset
      jest.doMock('../services', () => ({
        ProductService: { findAll: jest.fn().mockRejectedValue(new Error('DB error')) },
      }));

      const getAllProducts = require('../controllers/products/getAllProducts');

      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        render: jest.fn(),
      };
      const mockNext = jest.fn();

      await getAllProducts(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser error propagation (security fix)', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should call next(error) and NOT leak error.message to client', async () => {
      jest
        .spyOn(UserService, 'remove')
        .mockRejectedValue(new Error('SENSITIVE_INTERNAL_ERROR_12345'));

      const deleteUser = require('../controllers/users/deleteUser');

      const mockReq = { params: { id: '1' } };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        redirect: jest.fn(),
      };
      const mockNext = jest.fn();

      await deleteUser(mockReq, mockRes, mockNext);

      // Should call next(error), NOT res.status(500).send(`Error: ${error.message}`)
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.send).not.toHaveBeenCalled();
    });
  });

  describe('processLogin error propagation', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should call next(error) instead of res.status(500).json', async () => {
      jest.spyOn(UserService, 'findByEmail').mockRejectedValue(new Error('DB error'));

      const processLogin = require('../controllers/users/processLogin');

      const mockReq = { body: { email: 'test@test.com', password: 'pass', remember: false } };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        render: jest.fn(),
        redirect: jest.fn(),
        cookie: jest.fn(),
      };
      const mockNext = jest.fn();

      await processLogin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });
});
