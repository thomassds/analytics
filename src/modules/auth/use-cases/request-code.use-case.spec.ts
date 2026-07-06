import { AppError } from '../../../common/errors/app-error';
import { ValidationCodeType } from '../entities/validation-code.entity';
import { UserRepository } from '../repositories/user.repository';
import { ValidationCodeRepository } from '../repositories/validation-code.repository';
import { RequestCodeUseCase } from './request-code.use-case';

describe('RequestCodeUseCase', () => {
  const userRepository = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
  } as unknown as UserRepository;

  const validationCodeRepository = {
    invalidatePrevious: jest.fn(),
    insert: jest.fn(),
  } as unknown as ValidationCodeRepository;

  const emailProducer = {
    send: jest.fn(),
  };

  const smsProducer = {
    send: jest.fn(),
  };

  const useCase = new RequestCodeUseCase(
    userRepository,
    validationCodeRepository,
    emailProducer,
    smsProducer,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends an email validation code', async () => {
    userRepository.findById = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'john@example.com',
      phone: null,
    });
    validationCodeRepository.invalidatePrevious = jest
      .fn()
      .mockResolvedValue(undefined);
    validationCodeRepository.insert = jest.fn().mockResolvedValue(undefined);
    emailProducer.send = jest.fn().mockResolvedValue(undefined);

    const result = await useCase.execute({
      userId: 'a155f6b5-fadf-4e02-8d9a-096965cc5413',
      channel: 'email',
    });

    expect(result).toEqual({ sent: true, userId: 'user-1' });
    expect(validationCodeRepository.invalidatePrevious).toHaveBeenCalledWith(
      'user-1',
      ValidationCodeType.EMAIL,
    );
    expect(validationCodeRepository.insert).toHaveBeenCalledWith(
      'user-1',
      ValidationCodeType.EMAIL,
      expect.stringMatching(/^\d{6}$/),
      expect.any(Date),
    );
    expect(emailProducer.send).toHaveBeenCalledWith({
      to: 'john@example.com',
      template: 'validation-code',
      data: { code: expect.any(String) },
    });
    expect(smsProducer.send).not.toHaveBeenCalled();
  });

  it('throws USER_NOT_FOUND when user does not exist', async () => {
    userRepository.findByEmail = jest.fn().mockResolvedValue(null);

    await expect(
      useCase.execute({
        channel: 'email',
        email: 'unknown@example.com',
      }),
    ).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('sends sms code when phone is informed without userId', async () => {
    userRepository.findByPhone = jest.fn().mockResolvedValue({
      id: 'user-2',
      email: 'mary@example.com',
      phone: '11999999999',
    });
    validationCodeRepository.invalidatePrevious = jest
      .fn()
      .mockResolvedValue(undefined);
    validationCodeRepository.insert = jest.fn().mockResolvedValue(undefined);
    smsProducer.send = jest.fn().mockResolvedValue(undefined);

    const result = await useCase.execute({
      channel: 'phone',
      phone: '11999999999',
    });

    expect(result).toEqual({ sent: true, userId: 'user-2' });
    expect(validationCodeRepository.invalidatePrevious).toHaveBeenCalledWith(
      'user-2',
      ValidationCodeType.PHONE,
    );
    expect(validationCodeRepository.insert).toHaveBeenCalledWith(
      'user-2',
      ValidationCodeType.PHONE,
      expect.stringMatching(/^\d{6}$/),
      expect.any(Date),
    );
    expect(smsProducer.send).toHaveBeenCalledWith({
      to: '11999999999',
      code: expect.any(String),
      channel: 'sms',
    });
    expect(emailProducer.send).not.toHaveBeenCalled();
  });

  it('throws PHONE_NOT_FOUND when channel is phone and phone is missing', async () => {
    userRepository.findById = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'john@example.com',
      phone: null,
    });

    await expect(
      useCase.execute({
        userId: '2f2e1d2e-a2a2-4bd9-8f7a-cc357ca5f712',
        channel: 'phone',
      }),
    ).rejects.toMatchObject({
      code: 'PHONE_NOT_FOUND',
      statusCode: 400,
    });
  });
});
