import { Injectable, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AppError } from '../../../common/errors/app-error';
import { UserRepository } from '../repositories/user.repository';
import { ValidationCodeRepository } from '../repositories/validation-code.repository';
import {
  IEmailProducer,
  EMAIL_PRODUCER,
} from '../../messaging/contracts/email-producer.contract';
import { ValidationCodeType } from '../entities/validation-code.entity';
import { CreateUserDto } from '../dtos/create-user.dto';

@Injectable()
export class OnboardingUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly validationCodeRepository: ValidationCodeRepository,
    @Inject(EMAIL_PRODUCER)
    private readonly emailProducer: IEmailProducer,
  ) {}

  async execute(dto: CreateUserDto) {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new AppError('EMAIL_ALREADY_EXISTS', 409);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.userRepository.insert({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
    });

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.validationCodeRepository.insert(
      user.id,
      ValidationCodeType.EMAIL,
      code,
      expiresAt,
    );

    await this.emailProducer.send({
      to: user.email,
      template: 'validation-code',
      data: { code },
    });

    return { userId: user.id };
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
