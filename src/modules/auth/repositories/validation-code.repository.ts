import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ValidationCode,
  ValidationCodeType,
} from '../entities/validation-code.entity';

const MAX_ATTEMPTS = 5;

@Injectable()
export class ValidationCodeRepository {
  constructor(
    @InjectRepository(ValidationCode)
    private readonly repo: Repository<ValidationCode>,
  ) {}

  async findActive(
    userId: string,
    type: ValidationCodeType,
  ): Promise<ValidationCode | null> {
    return this.repo.findOne({
      where: { userId, type, used: false },
      order: { createdAt: 'DESC' },
    });
  }

  async findCode(
    userId: string,
    type: ValidationCodeType,
    code: string,
  ): Promise<ValidationCode | null> {
    return this.repo.findOne({
      where: { userId, type, code },
    });
  }

  async invalidatePrevious(
    userId: string,
    type: ValidationCodeType,
  ): Promise<void> {
    await this.repo.update({ userId, type, used: false }, { used: true });
  }

  async insert(
    userId: string,
    type: ValidationCodeType,
    code: string,
    expiresAt: Date,
  ): Promise<ValidationCode> {
    const record = this.repo.create({ userId, type, code, expiresAt });
    return this.repo.save(record);
  }

  async incrementAttempts(id: string, attempts: number): Promise<void> {
    await this.repo.update(id, { attempts });
  }

  async markAsUsed(id: string): Promise<void> {
    await this.repo.update(id, { used: true });
  }

  getMaxAttempts(): number {
    return MAX_ATTEMPTS;
  }
}
