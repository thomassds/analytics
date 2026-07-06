import { Injectable, Inject } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error';
import { unmaskPhone } from '../../../common/utils/mask-phone';
import { toE164 } from '../../../common/utils/phone-e164';
import { UserRepository } from '../repositories/user.repository';
import { ValidationCodeRepository } from '../repositories/validation-code.repository';
import {
  IEmailProducer,
  EMAIL_PRODUCER,
} from '../../messaging/contracts/email-producer.contract';
import {
  ISmsProducer,
  SMS_PRODUCER,
} from '../../messaging/contracts/sms-producer.contract';
import { ValidationCodeType } from '../entities/validation-code.entity';
import { RequestCodeDto } from '../dtos/request-code.dto';

@Injectable()
export class RequestCodeUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly validationCodeRepository: ValidationCodeRepository,
    @Inject(EMAIL_PRODUCER)
    private readonly emailProducer: IEmailProducer,
    @Inject(SMS_PRODUCER)
    private readonly smsProducer: ISmsProducer,
  ) {}

  async execute(dto: RequestCodeDto) {
    const user = await this.resolveUser(dto);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 404);
    }

    const type =
      dto.channel === 'email'
        ? ValidationCodeType.EMAIL
        : ValidationCodeType.PHONE;

    const to = dto.channel === 'email' ? user.email : user.phone;
    if (!to) {
      throw new AppError(
        dto.channel === 'phone' ? 'PHONE_NOT_FOUND' : 'EMAIL_NOT_FOUND',
        400,
      );
    }

    await this.validationCodeRepository.invalidatePrevious(user.id, type);

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.validationCodeRepository.insert(user.id, type, code, expiresAt);

    if (dto.channel === 'email') {
      await this.emailProducer.send({
        to,
        template: 'validation-code',
        data: { code },
      });
    } else {
      await this.smsProducer.send({
        to: toE164(user.countryCode, to)!,
        code,
        channel: 'sms',
      });
    }

    return { sent: true, userId: user.id };
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async resolveUser(dto: RequestCodeDto) {
    if (dto.userId) {
      return this.userRepository.findById(dto.userId);
    }

    if (dto.channel === 'email' && dto.email) {
      return this.userRepository.findByEmail(dto.email);
    }

    if (dto.channel === 'phone' && dto.phone) {
      return this.userRepository.findByPhone(unmaskPhone(dto.phone)!);
    }

    return null;
  }
}
