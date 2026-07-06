import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('competitions')
export class Competition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'external_ref', length: 100, unique: true })
  externalRef: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 20 })
  season: string;

  @Column({ name: 'league_id', type: 'uuid', nullable: true })
  leagueId: string | null;

  @Column({ name: 'has_events', default: false })
  hasEvents: boolean;

  @Column({ name: 'has_statistics', default: false })
  hasStatistics: boolean;

  @Column({ name: 'has_lineups', default: false })
  hasLineups: boolean;

  @Column({ name: 'is_current', default: false })
  isCurrent: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
