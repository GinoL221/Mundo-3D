import { CreateRememberTokenUseCase } from '../use-cases/CreateRememberTokenUseCase';
import { VerifyRememberTokenUseCase } from '../use-cases/VerifyRememberTokenUseCase';
import { DeleteRememberTokenUseCase } from '../use-cases/DeleteRememberTokenUseCase';
import { RememberTokenRepositoryPort } from '../../domain/ports/RememberTokenRepositoryPort';
import { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';
import { TokenHasherPort } from '../../domain/ports/TokenHasherPort';
import { IdGeneratorPort } from '../../domain/ports/IdGeneratorPort';
import { RememberToken } from '../../domain/entities/RememberToken';
import { User } from '../../domain/entities/User';

describe('RememberToken Use Cases', () => {
  let mockRememberTokenRepo: jest.Mocked<RememberTokenRepositoryPort>;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockTokenHasher: jest.Mocked<TokenHasherPort>;
  let mockIdGenerator: jest.Mocked<IdGeneratorPort>;

  beforeEach(() => {
    mockRememberTokenRepo = {
      create: jest.fn(),
      findByHash: jest.fn(),
      deleteByHash: jest.fn(),
    } as unknown as jest.Mocked<RememberTokenRepositoryPort>;

    mockUserRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UserRepositoryPort>;

    mockTokenHasher = {
      hash: jest.fn(),
    } as unknown as jest.Mocked<TokenHasherPort>;

    mockIdGenerator = {
      generate: jest.fn(),
    } as unknown as jest.Mocked<IdGeneratorPort>;
  });

  describe('CreateRememberTokenUseCase', () => {
    it('should create a remember token and return the DTO', async () => {
      const useCase = new CreateRememberTokenUseCase(mockRememberTokenRepo, mockTokenHasher, mockIdGenerator);

      mockTokenHasher.hash.mockReturnValue('hashedPlainToken123');
      mockIdGenerator.generate.mockReturnValue('family-99');

      const expectedDate = new Date();
      const mockCreated = new RememberToken(
        99,
        'hashedPlainToken123',
        10,
        expectedDate,
        expectedDate,
        'family-99'
      );

      mockRememberTokenRepo.create.mockResolvedValue(mockCreated);

      const result = await useCase.execute({
        idUser: 10,
        plainToken: 'myPlainToken',
        durationSeconds: 3600,
      });

      expect(result).toEqual({
        idRememberToken: 99,
        tokenHash: 'hashedPlainToken123',
        idUser: 10,
        expiryDate: expectedDate,
        createdAt: expectedDate,
        familyId: 'family-99',
      });

      expect(mockTokenHasher.hash).toHaveBeenCalledWith('myPlainToken');
      expect(mockRememberTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: 'hashedPlainToken123',
          idUser: 10,
          expiryDate: expect.any(Date),
          familyId: 'family-99',
        })
      );
    });

    // HIGH-1 PR1 (design.md D1): family provisioning ships now even though
    // reuse-revocation logic is deferred — a later migration would leave a
    // 30-day window with no family data to detect reuse against. Random
    // generation itself is proven by `CryptoRandomIdGenerator.test.ts`; this
    // use case only needs to prove it delegates to the injected port and
    // persists whatever it returns, never a hardcoded value of its own.
    it('persists whatever the injected IdGeneratorPort returns as familyId, per call', async () => {
      const useCase = new CreateRememberTokenUseCase(mockRememberTokenRepo, mockTokenHasher, mockIdGenerator);
      mockTokenHasher.hash.mockReturnValue('hashedPlainToken123');
      mockIdGenerator.generate.mockReturnValueOnce('family-a').mockReturnValueOnce('family-b');
      mockRememberTokenRepo.create.mockResolvedValue(
        new RememberToken(99, 'hashedPlainToken123', 10, new Date(), new Date(), 'family-a')
      );

      await useCase.execute({ idUser: 10, plainToken: 'myPlainToken', durationSeconds: 3600 });
      await useCase.execute({ idUser: 11, plainToken: 'anotherPlainToken', durationSeconds: 3600 });

      expect(mockRememberTokenRepo.create.mock.calls[0][0].familyId).toBe('family-a');
      expect(mockRememberTokenRepo.create.mock.calls[1][0].familyId).toBe('family-b');
      expect(mockIdGenerator.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe('VerifyRememberTokenUseCase', () => {
    let useCase: VerifyRememberTokenUseCase;

    beforeEach(() => {
      useCase = new VerifyRememberTokenUseCase(
        mockRememberTokenRepo,
        mockUserRepo,
        mockTokenHasher
      );
    });

    it('should return null if remember token is not found in database', async () => {
      mockTokenHasher.hash.mockReturnValue('hashedPlainToken');
      mockRememberTokenRepo.findByHash.mockResolvedValue(null);

      const result = await useCase.execute('myPlainToken');

      expect(result).toBeNull();
      expect(mockTokenHasher.hash).toHaveBeenCalledWith('myPlainToken');
      expect(mockRememberTokenRepo.findByHash).toHaveBeenCalledWith('hashedPlainToken');
      expect(mockUserRepo.findById).not.toHaveBeenCalled();
    });

    it('should delete token and return null if token is expired', async () => {
      mockTokenHasher.hash.mockReturnValue('hashedPlainToken');
      
      const expiredDate = new Date(Date.now() - 10000); // 10s in the past
      const expiredToken = new RememberToken(1, 'hashedPlainToken', 5, expiredDate);
      
      mockRememberTokenRepo.findByHash.mockResolvedValue(expiredToken);
      mockRememberTokenRepo.deleteByHash.mockResolvedValue(true);

      const result = await useCase.execute('myPlainToken');

      expect(result).toBeNull();
      expect(mockRememberTokenRepo.deleteByHash).toHaveBeenCalledWith('hashedPlainToken');
      expect(mockUserRepo.findById).not.toHaveBeenCalled();
    });

    it('should return user DTO if token is valid and user exists', async () => {
      mockTokenHasher.hash.mockReturnValue('hashedPlainToken');
      
      const futureDate = new Date(Date.now() + 10000); // 10s in the future
      const validToken = new RememberToken(1, 'hashedPlainToken', 5, futureDate);
      
      const user = new User(5, 'Alice', 'Smith', 'alice@example.com', 'hashedPass', 'alice.png', 2, 'VIP');

      mockRememberTokenRepo.findByHash.mockResolvedValue(validToken);
      mockUserRepo.findById.mockResolvedValue(user);

      const result = await useCase.execute('myPlainToken');

      expect(result).toEqual({
        idUser: 5,
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        image: 'alice.png',
        idRole: 2,
        category: 'VIP',
      });

      expect(mockUserRepo.findById).toHaveBeenCalledWith(5);
      expect(mockRememberTokenRepo.deleteByHash).not.toHaveBeenCalled();
    });

    it('should return null if user is not found in database', async () => {
      mockTokenHasher.hash.mockReturnValue('hashedPlainToken');

      const futureDate = new Date(Date.now() + 10000);
      const validToken = new RememberToken(1, 'hashedPlainToken', 5, futureDate);

      mockRememberTokenRepo.findByHash.mockResolvedValue(validToken);
      mockUserRepo.findById.mockResolvedValue(null);

      const result = await useCase.execute('myPlainToken');

      expect(result).toBeNull();
      expect(mockUserRepo.findById).toHaveBeenCalledWith(5);
    });

    // remember-token-store spec, "Verifying a revoked token fails without
    // deleting it" — logout must beat an otherwise-unexpired token, and the
    // row must survive (design.md D2: revocation is terminal, not deletion).
    it('should return null for a revoked token WITHOUT deleting the row, checked before the expiry branch', async () => {
      mockTokenHasher.hash.mockReturnValue('hashedPlainToken');

      const futureDate = new Date(Date.now() + 10000); // unexpired
      const revokedToken = new RememberToken(1, 'hashedPlainToken', 5, futureDate, null, 'family-1', null, null, new Date());

      mockRememberTokenRepo.findByHash.mockResolvedValue(revokedToken);

      const result = await useCase.execute('myPlainToken');

      expect(result).toBeNull();
      expect(mockRememberTokenRepo.deleteByHash).not.toHaveBeenCalled();
      expect(mockUserRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe('DeleteRememberTokenUseCase', () => {
    it('should hash token and call repo deletion', async () => {
      const useCase = new DeleteRememberTokenUseCase(mockRememberTokenRepo, mockTokenHasher);

      mockTokenHasher.hash.mockReturnValue('hashedTokenToDelete');
      mockRememberTokenRepo.deleteByHash.mockResolvedValue(true);

      const result = await useCase.execute('plainTokenToDelete');

      expect(result).toBe(true);
      expect(mockTokenHasher.hash).toHaveBeenCalledWith('plainTokenToDelete');
      expect(mockRememberTokenRepo.deleteByHash).toHaveBeenCalledWith('hashedTokenToDelete');
    });
  });
});
