import { ValidationCodeType } from '../entities/validation-code.entity';
import { UserRepository } from '../repositories/user.repository';
import { ValidationCodeRepository } from '../repositories/validation-code.repository';
import { RecoveryPasswordUseCase } from './recovery-password.use-case';

describe('RecoveryPasswordUseCase', () => {
  const userRepository = {
    findById: jest.fn(),
    update: jest.fn(),
  } as unknown as UserRepository;

  const validationCodeRepository = {
    findCode: jest.fn(),
    getMaxAttempts: jest.fn(),
    incrementAttempts: jest.fn(),
    markAsUsed: jest.fn(),
  } as unknown as ValidationCodeRepository;

  const useCase = new RecoveryPasswordUseCase(
    userRepository,
    validationCodeRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates password with hash and marks code as used', async () => {
    userRepository.findById = jest.fn().mockResolvedValue({ id: 'user-1' });
    validationCodeRepository.findCode = jest.fn().mockResolvedValue({
      id: 'code-1',
      code: '123456',
      used: true,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });
    validationCodeRepository.getMaxAttempts = jest.fn().mockReturnValue(5);
    userRepository.update = jest.fn().mockResolvedValue(undefined);
    validationCodeRepository.markAsUsed = jest
      .fn()
      .mockResolvedValue(undefined);

    const result = await useCase.execute({
      userId: 'cd025ec2-ff38-4a56-b2ca-18cd90d6e9c0',
      type: 'email',
      code: '123456',
      password: 'NovaSenha123',
    });

    expect(result).toEqual({ updated: true });
    expect(validationCodeRepository.findCode).toHaveBeenCalledWith(
      'cd025ec2-ff38-4a56-b2ca-18cd90d6e9c0',
      ValidationCodeType.EMAIL,
      '123456',
    );
    expect(userRepository.update).toHaveBeenCalledWith(
      'cd025ec2-ff38-4a56-b2ca-18cd90d6e9c0',
      { password: expect.any(String) },
    );
    expect(validationCodeRepository.markAsUsed).toHaveBeenCalledWith('code-1');
  });

  it('throws USER_NOT_FOUND when user does not exist', async () => {
    userRepository.findById = jest.fn().mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: 'f5ec5f09-060b-4114-9f9f-6af4e2d225c6',
        type: 'email',
        code: '123456',
        password: 'NovaSenha123',
      }),
    ).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('increments attempts and throws INVALID_CODE when code does not match', async () => {
    userRepository.findById = jest.fn().mockResolvedValue({ id: 'user-1' });
    validationCodeRepository.findCode = jest.fn().mockResolvedValue({
      id: 'code-1',
      code: '123456',
      used: true,
      attempts: 1,
      expiresAt: new Date(Date.now() + 60_000),
    });
    validationCodeRepository.getMaxAttempts = jest.fn().mockReturnValue(5);
    validationCodeRepository.incrementAttempts = jest
      .fn()
      .mockResolvedValue(undefined);

    await expect(
      useCase.execute({
        userId: '33802c53-7d3c-412d-a70c-bcc89e79e569',
        type: 'phone',
        code: '654321',
        password: 'NovaSenha123',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CODE',
      statusCode: 400,
    });

    expect(validationCodeRepository.incrementAttempts).toHaveBeenCalledWith(
      'code-1',
      2,
    );
    expect(userRepository.update).not.toHaveBeenCalled();
    expect(validationCodeRepository.markAsUsed).not.toHaveBeenCalled();
  });
});
