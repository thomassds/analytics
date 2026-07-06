import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Catálogo fiel de tipos de evento. SEM `weight` — a ponderação é regra da análise. */
@Entity('event_types')
export class EventType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 40, unique: true })
  code: string;

  @Column({ length: 40 })
  category: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
