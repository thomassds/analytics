import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository';
import { LoginUseCase } from './login.use-case';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('LoginUseCase', () => {
  const userRepository = {
    findByEmail: jest.fn(),
  } as unknown as UserRepository;

  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as JwtService;

  const useCase = new LoginUseCase(userRepository, jwtService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns token and user data when credentials are valid', async () => {
    userRepository.findByEmail = jest.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: 'hashed-password',
      taxIdentifier: null,
      phone: null,
      validatedEmailAt: new Date(),
      validatedPhoneAt: null,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwtService.signAsync = jest.fn().mockResolvedValue('jwt-token');

    const result = await useCase.execute({
      email: 'joao@email.com',
      password: 'Senha123',
    });

    expect(result).toEqual({
      accessToken: 'jwt-token',
      user: {
        id: 'user-1',
        name: 'Joao Silva',
        email: 'joao@email.com',
        taxIdentifier: null,
        phone: null,
        validatedEmailAt: expect.any(Date),
        validatedPhoneAt: null,
      },
    });
    expect(userRepository.findByEmail).toHaveBeenCalledWith('joao@email.com');
    expect(bcrypt.compare).toHaveBeenCalledWith('Senha123', 'hashed-password');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'joao@email.com',
      name: 'Joao Silva',
    });
  });

  it('throws USER_NOT_FOUND when email does not exist', async () => {
    userRepository.findByEmail = jest.fn().mockResolvedValue(null);

    await expect(
      useCase.execute({
        email: 'unknown@email.com',
        password: 'Senha123',
      }),
    ).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('throws INVALID_CREDENTIALS when password does not match', async () => {
    userRepository.findByEmail = jest.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: 'hashed-password',
      validatedEmailAt: new Date(),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: 'joao@email.com',
        password: 'SenhaErrada123',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 400,
    });
  });
});
