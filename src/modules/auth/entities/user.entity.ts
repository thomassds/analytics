import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ name: 'validated_email_at', type: 'timestamp', nullable: true })
  validatedEmailAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  phone: string | null;

  @Column({
    name: 'country_code',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  countryCode: string | null;

  @Column({ name: 'validated_phone_at', type: 'timestamp', nullable: true })
  validatedPhoneAt: Date | null;

  @Column({
    name: 'tax_identifier',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  taxIdentifier: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_platform_admin', default: false })
  isPlatformAdmin: boolean;

  @Column({ name: 'zip_code', type: 'varchar', length: 20, nullable: true })
  zipCode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  street: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  neighborhood: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  complement: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
