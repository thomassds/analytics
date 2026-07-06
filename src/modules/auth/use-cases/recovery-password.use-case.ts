import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AppError } from '../../../common/errors/app-error';
import { UserRepository } from '../repositories/user.repository';
import { ValidationCodeRepository } from '../repositories/validation-code.repository';
import { ValidationCodeType } from '../entities/validation-code.entity';
import { RecoveryPasswordDto } from '../dtos/recovery-password.dto';

@Injectable()
export class RecoveryPasswordUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly validationCodeRepository: ValidationCodeRepository,
  ) {}

  async execute(dto: RecoveryPasswordDto) {
    const user = await this.userRepository.findById(dto.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 404);
    }

    const type =
      dto.type === 'email'
        ? ValidationCodeType.EMAIL
        : ValidationCodeType.PHONE;

    const record = await this.validationCodeRepository.findCode(
      dto.userId,
      type,
      dto.code,
    );
    if (!record) {
      throw new AppError('INVALID_CODE', 400);
    }

    if (record.used) {
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

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    await this.validationCodeRepository.markAsUsed(record.id);

    await this.userRepository.update(dto.userId, {
      password: hashedPassword,
    });

    return { updated: true };
  }
}
