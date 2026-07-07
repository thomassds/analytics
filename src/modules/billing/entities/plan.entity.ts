import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BillingInterval = 'month' | 'year';

/** Plano de assinatura. Espelhado na Stripe como Product + Price recorrente. */
@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Preço em centavos (ex.: 2990 = R$ 29,90). */
  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  @Column({ length: 3, default: 'brl' })
  currency: string;

  @Column({ type: 'varchar', length: 10, default: 'month' })
  interval: BillingInterval;

  @Column({ name: 'stripe_product_id', type: 'varchar', length: 255, nullable: true })
  stripeProductId: string | null;

  @Column({ name: 'stripe_price_id', type: 'varchar', length: 255, nullable: true })
  stripePriceId: string | null;

  /** Inativo = não aparece pra novos assinantes (não deleta histórico). */
  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
