import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum ValidationCodeType {
  EMAIL = 'email',
  PHONE = 'phone',
}

@Entity('validation_codes')
export class ValidationCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ length: 6 })
  code: string;

  @Column({ type: 'varchar', length: 20 })
  type: ValidationCodeType;

  @Column({ default: 0 })
  attempts: number;

  @Column({ default: false })
  used: boolean;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
