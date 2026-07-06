import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Catálogo mestre de ligas (descoberta via /leagues). */
@Entity('leagues')
export class League {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'external_ref', length: 20, unique: true })
  externalRef: string;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  type: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  country: string | null;

  @Column({ name: 'is_national', default: false })
  isNational: boolean;

  @Column({ name: 'ingest_enabled', default: false })
  ingestEnabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
