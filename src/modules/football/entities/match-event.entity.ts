import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Evento atômico: 1 ocorrência por linha, com seu tipo verdadeiro. */
@Entity('match_events')
export class MatchEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'match_id', type: 'uuid' })
  matchId: string;

  @Column({ name: 'event_type_id', type: 'uuid' })
  eventTypeId: string;

  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @Column({ name: 'player_id', type: 'uuid', nullable: true })
  playerId: string | null;

  @Column({ type: 'int', nullable: true })
  minute: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
