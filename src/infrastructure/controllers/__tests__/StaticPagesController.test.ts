import { StaticPagesController } from '../StaticPagesController';
import { Request, Response } from 'express';

describe('StaticPagesController', () => {
  let controller: StaticPagesController;
  let mockListProductsUseCase: any;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    mockListProductsUseCase = { execute: jest.fn() };

    controller = new StaticPagesController(mockListProductsUseCase);

    req = {};
    res = {
      render: jest.fn(),
    };
    next = jest.fn();
  });


  describe('pure-render pages', () => {
    it('aboutUs should render aboutUs view', () => {
      controller.aboutUs(req as Request, res as Response);
      expect(res.render).toHaveBeenCalledWith('aboutUs');
    });

    it('faq should render faq view', () => {
      controller.faq(req as Request, res as Response);
      expect(res.render).toHaveBeenCalledWith('faq');
    });

    it('help should render help view', () => {
      controller.help(req as Request, res as Response);
      expect(res.render).toHaveBeenCalledWith('help');
    });

    it('privacy should render privacy view', () => {
      controller.privacy(req as Request, res as Response);
      expect(res.render).toHaveBeenCalledWith('privacy');
    });

    it('stepByStep should render step-by-step view', () => {
      controller.stepByStep(req as Request, res as Response);
      expect(res.render).toHaveBeenCalledWith('step-by-step');
    });

    it('terms should render terms view', () => {
      controller.terms(req as Request, res as Response);
      expect(res.render).toHaveBeenCalledWith('terms');
    });
  });

  describe('home', () => {
    it('should render index with products and adapted nested Category shape on success', async () => {
      const mockResult = {
        count: 1,
        products: [
          {
            IDProduct: 1,
            NameProduct: 'Test Product',
            Price: 100,
            DescriptionProduct: 'Desc',
            Image: 'img.jpg',
            IDCategory: 1,
            IDFranchise: 1,
            Category: 'Cat 1',
          },
        ],
        countByCategory: {},
      };
      mockListProductsUseCase.execute.mockResolvedValue(mockResult);

      await controller.home(req as Request, res as Response);

      expect(mockListProductsUseCase.execute).toHaveBeenCalledTimes(1);
      expect(res.render).toHaveBeenCalledWith('index', {
        products: [
          {
            IDProduct: 1,
            NameProduct: 'Test Product',
            Price: 100,
            DescriptionProduct: 'Desc',
            Image: 'img.jpg',
            IDCategory: 1,
            IDFranchise: 1,
            Category: { NameCategory: 'Cat 1' },
          },
        ],
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should degrade to empty products list and not call next when use case rejects', async () => {
      const error = new Error('db');
      mockListProductsUseCase.execute.mockRejectedValue(error);

      await controller.home(req as Request, res as Response);

      expect(res.render).toHaveBeenCalledWith('index', { products: [] });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
