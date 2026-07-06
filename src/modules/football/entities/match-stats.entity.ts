import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Estatística agregada de um time numa partida (chutes, etc.). */
@Entity('match_stats')
export class MatchStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'match_id', type: 'uuid' })
  matchId: string;

  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @Column({ name: 'total_shots', type: 'int', nullable: true })
  totalShots: number | null;

  @Column({ name: 'shots_on_goal', type: 'int', nullable: true })
  shotsOnGoal: number | null;

  @Column({ name: 'corner_kicks', type: 'int', nullable: true })
  cornerKicks: number | null;

  @Column({ name: 'fouls', type: 'int', nullable: true })
  fouls: number | null;

  @Column({ name: 'offsides', type: 'int', nullable: true })
  offsides: number | null;

  @Column({ name: 'goalkeeper_saves', type: 'int', nullable: true })
  goalkeeperSaves: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
