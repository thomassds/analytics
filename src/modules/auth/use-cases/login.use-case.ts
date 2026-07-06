import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AppError } from '../../../common/errors/app-error';
import { LoginDto } from '../dtos/login.dto';
import { UserRepository } from '../repositories/user.repository';
import { maskTaxIdentifier } from '../../../common/utils/mask-tax-identifier';
import { maskPhone } from '../../../common/utils/mask-phone';

type LoginResult = {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    taxIdentifier: string | null;
    phone: string | null;
    validatedEmailAt: Date | null;
    validatedPhoneAt: Date | null;
  };
};

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: LoginDto): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      throw new AppError('USER_NOT_FOUND', 404);
    }

    if (!user.password) {
      throw new AppError('INVALID_CREDENTIALS', 400);
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new AppError('INVALID_CREDENTIALS', 400);
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        taxIdentifier: maskTaxIdentifier(user.taxIdentifier),
        phone: maskPhone(user.phone),
        validatedEmailAt: user.validatedEmailAt,
        validatedPhoneAt: user.validatedPhoneAt,
      },
    };
  }
}
