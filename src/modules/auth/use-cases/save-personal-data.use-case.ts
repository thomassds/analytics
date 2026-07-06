import { Injectable, Inject } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error';
import { unmaskPhone } from '../../../common/utils/mask-phone';
import { toE164 } from '../../../common/utils/phone-e164';
import { unmaskTaxIdentifier } from '../../../common/utils/mask-tax-identifier';
import { UserRepository } from '../repositories/user.repository';
import { ValidationCodeRepository } from '../repositories/validation-code.repository';
import {
  ISmsProducer,
  SMS_PRODUCER,
} from '../../messaging/contracts/sms-producer.contract';
import { ValidationCodeType } from '../entities/validation-code.entity';
import { PersonalDataDto } from '../dtos/personal-data.dto';

@Injectable()
export class SavePersonalDataUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly validationCodeRepository: ValidationCodeRepository,
    @Inject(SMS_PRODUCER)
    private readonly smsProducer: ISmsProducer,
  ) {}

  async execute(dto: PersonalDataDto) {
    const user = await this.userRepository.findById(dto.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 404);
    }

    if (!user.validatedEmailAt) {
      throw new AppError('EMAIL_NOT_VALIDATED', 400);
    }

    const phone = unmaskPhone(dto.phone);
    const countryCode = dto.countryCode.replace(/\D/g, '');
    const taxIdentifier = unmaskTaxIdentifier(dto.taxIdentifier);

    const existingPhone = await this.userRepository.findByPhone(phone!);
    if (existingPhone && existingPhone.id !== dto.userId) {
      throw new AppError('PHONE_ALREADY_EXISTS', 409);
    }

    await this.userRepository.update(dto.userId, {
      phone,
      countryCode,
      taxIdentifier,
      zipCode: dto.zipCode,
      street: dto.street,
      neighborhood: dto.neighborhood,
      city: dto.city,
      state: dto.state,
      number: dto.number,
      complement: dto.complement ?? null,
    });

    await this.validationCodeRepository.invalidatePrevious(
      dto.userId,
      ValidationCodeType.PHONE,
    );

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.validationCodeRepository.insert(
      dto.userId,
      ValidationCodeType.PHONE,
      code,
      expiresAt,
    );

    await this.smsProducer.send({
      to: toE164(countryCode, phone)!,
      code,
      channel: 'sms',
    });

    return { sent: true };
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
