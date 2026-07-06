import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MatchStatus {
  SCHEDULED = 0,
  IN_PROGRESS = 1,
  FINISHED = 2,
  CANCELLED = 3, // cancelado/adiado/abandonado/W.O. — não vai acontecer
}

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'external_ref', length: 100, unique: true })
  externalRef: string;

  @Column({ name: 'competition_id', type: 'uuid' })
  competitionId: string;

  @Column({ name: 'home_team_id', type: 'uuid' })
  homeTeamId: string;

  @Column({ name: 'away_team_id', type: 'uuid' })
  awayTeamId: string;

  @Column({ name: 'referee_id', type: 'uuid', nullable: true })
  refereeId: string | null;

  @Column({ length: 20 })
  season: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  round: string | null;

  @Column({ name: 'kickoff_at', type: 'timestamp' })
  kickoffAt: Date;

  @Column({ type: 'int', default: MatchStatus.SCHEDULED })
  status: MatchStatus;

  @Column({ type: 'int', nullable: true })
  elapsed: number | null; // minuto atual (durante o ao vivo)

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
