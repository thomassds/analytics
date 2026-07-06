import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error';
import { UserRepository } from '../repositories/user.repository';
import { ValidationCodeRepository } from '../repositories/validation-code.repository';
import { ValidationCodeType } from '../entities/validation-code.entity';
import { ValidateCodeDto } from '../dtos/validate-code.dto';

@Injectable()
export class ValidateCodeUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly validationCodeRepository: ValidationCodeRepository,
  ) {}

  async execute(dto: ValidateCodeDto) {
    const type =
      dto.type === 'email'
        ? ValidationCodeType.EMAIL
        : ValidationCodeType.PHONE;

    const record = await this.validationCodeRepository.findActive(
      dto.userId,
      type,
    );

    if (!record) {
      throw new AppError('INVALID_CODE', 400);
    }

    const maxAttempts = this.validationCodeRepository.getMaxAttempts();
    if (record.attempts >= maxAttempts) {
      throw new AppError('CODE_MAX_ATTEMPTS_EXCEEDED', 400);
    }

    if (new Date() > record.expiresAt) {
      throw new AppError('CODE_EXPIRED', 400);
    }

    if (record.code !== dto.code) {
      await this.validationCodeRepository.incrementAttempts(
        record.id,
        record.attempts + 1,
      );
      throw new AppError('INVALID_CODE', 400);
    }

    if (dto.justCheck) {
      return {
        validated: true,
        userId: dto.userId,
        type: dto.type,
      };
    }

    await this.validationCodeRepository.markAsUsed(record.id);

    const update =
      dto.type === 'email'
        ? { validatedEmailAt: new Date() }
        : { validatedPhoneAt: new Date() };

    await this.userRepository.update(dto.userId, update);

    return {
      validated: true,
      userId: dto.userId,
      type: dto.type,
    };
  }
}
