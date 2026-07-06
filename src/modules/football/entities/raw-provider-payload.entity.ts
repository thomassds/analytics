import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Landing zone: payload cru do provedor, imutável, reprocessável sem gastar cota. */
@Entity('raw_provider_payloads')
export class RawProviderPayload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 40 })
  provider: string;

  @Column({ length: 40 })
  resource: string;

  @Column({ name: 'external_ref', length: 100 })
  externalRef: string;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @Column({ name: 'fetched_at', type: 'timestamp', default: () => 'now()' })
  fetchedAt: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
