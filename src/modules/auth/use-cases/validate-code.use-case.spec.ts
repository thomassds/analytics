import { AppError } from '../../../common/errors/app-error';
import { ValidationCodeType } from '../entities/validation-code.entity';
import { UserRepository } from '../repositories/user.repository';
import { ValidationCodeRepository } from '../repositories/validation-code.repository';
import { ValidateCodeUseCase } from './validate-code.use-case';

describe('ValidateCodeUseCase', () => {
  const userRepository = {
    update: jest.fn(),
  } as unknown as UserRepository;

  const validationCodeRepository = {
    findActive: jest.fn(),
    getMaxAttempts: jest.fn(),
    incrementAttempts: jest.fn(),
    markAsUsed: jest.fn(),
  } as unknown as ValidationCodeRepository;

  const useCase = new ValidateCodeUseCase(
    userRepository,
    validationCodeRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates the code and updates validatedEmailAt', async () => {
    const now = new Date();
    validationCodeRepository.findActive = jest.fn().mockResolvedValue({
      id: 'code-1',
      code: '123456',
      attempts: 0,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    validationCodeRepository.getMaxAttempts = jest.fn().mockReturnValue(5);
    validationCodeRepository.markAsUsed = jest
      .fn()
      .mockResolvedValue(undefined);
    userRepository.update = jest.fn().mockResolvedValue(undefined);

    const result = await useCase.execute({
      userId: 'bf3ec304-c597-4d73-8f26-e515a938f1a8',
      type: 'email',
      code: '123456',
    });

    expect(result).toEqual({
      validated: true,
      userId: 'bf3ec304-c597-4d73-8f26-e515a938f1a8',
      type: 'email',
    });
    expect(validationCodeRepository.findActive).toHaveBeenCalledWith(
      'bf3ec304-c597-4d73-8f26-e515a938f1a8',
      ValidationCodeType.EMAIL,
    );
    expect(validationCodeRepository.markAsUsed).toHaveBeenCalledWith('code-1');
    expect(userRepository.update).toHaveBeenCalledWith(
      'bf3ec304-c597-4d73-8f26-e515a938f1a8',
      { validatedEmailAt: expect.any(Date) },
    );
  });

  it('increments attempts and throws INVALID_CODE when code does not match', async () => {
    validationCodeRepository.findActive = jest.fn().mockResolvedValue({
      id: 'code-1',
      code: '123456',
      attempts: 2,
      expiresAt: new Date(Date.now() + 60_000),
    });
    validationCodeRepository.getMaxAttempts = jest.fn().mockReturnValue(5);
    validationCodeRepository.incrementAttempts = jest
      .fn()
      .mockResolvedValue(undefined);

    await expect(
      useCase.execute({
        userId: 'edf0c8d1-f9f4-4f37-a96f-0237f6d08f0f',
        type: 'phone',
        code: '999999',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CODE',
      statusCode: 400,
    });

    expect(validationCodeRepository.incrementAttempts).toHaveBeenCalledWith(
      'code-1',
      3,
    );
    expect(validationCodeRepository.markAsUsed).not.toHaveBeenCalled();
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('returns validation data without consuming code when justCheck is true', async () => {
    validationCodeRepository.findActive = jest.fn().mockResolvedValue({
      id: 'code-1',
      code: '123456',
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });
    validationCodeRepository.getMaxAttempts = jest.fn().mockReturnValue(5);

    const result = await useCase.execute({
      userId: '0fb17ebf-6969-42d5-ab4c-b5395262da08',
      type: 'phone',
      code: '123456',
      justCheck: true,
    });

    expect(result).toEqual({
      validated: true,
      userId: '0fb17ebf-6969-42d5-ab4c-b5395262da08',
      type: 'phone',
    });
    expect(validationCodeRepository.markAsUsed).not.toHaveBeenCalled();
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('throws CODE_EXPIRED when code is expired', async () => {
    validationCodeRepository.findActive = jest.fn().mockResolvedValue({
      id: 'code-1',
      code: '123456',
      attempts: 0,
      expiresAt: new Date(Date.now() - 1_000),
    });
    validationCodeRepository.getMaxAttempts = jest.fn().mockReturnValue(5);

    await expect(
      useCase.execute({
        userId: 'fe2f0328-20b4-4de4-a969-7db6e0f22088',
        type: 'email',
        code: '123456',
      }),
    ).rejects.toMatchObject({
      code: 'CODE_EXPIRED',
      statusCode: 400,
    });
  });
});
