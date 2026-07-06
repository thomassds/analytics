import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Competition } from '../entities/competition.entity';
import { Team } from '../entities/team.entity';
import { Player } from '../entities/player.entity';
import { Referee } from '../entities/referee.entity';
import { EventType } from '../entities/event-type.entity';
import { Match, MatchStatus } from '../entities/match.entity';
import { MatchEvent } from '../entities/match-event.entity';
import { MatchStats } from '../entities/match-stats.entity';

/** Upserts idempotentes por external_ref para a camada de ingestão (mapper). */
@Injectable()
export class IngestionRepository {
  constructor(
    @InjectRepository(Competition)
    private readonly competitions: Repository<Competition>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(Player) private readonly players: Repository<Player>,
    @InjectRepository(Referee) private readonly referees: Repository<Referee>,
    @InjectRepository(EventType)
    private readonly eventTypes: Repository<EventType>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(MatchEvent)
    private readonly matchEvents: Repository<MatchEvent>,
    @InjectRepository(MatchStats)
    private readonly matchStats: Repository<MatchStats>,
  ) {}

  /** Substitui as estatísticas de uma partida (idempotência por match_id). */
  async replaceMatchStats(
    matchId: string,
    stats: Array<Omit<MatchStats, 'id' | 'createdAt'>>,
  ): Promise<void> {
    await this.matchStats.delete({ matchId });
    if (stats.length > 0) await this.matchStats.insert(stats);
  }

  async upsertCompetition(data: {
    externalRef: string;
    name: string;
    season: string;
  }): Promise<string> {
    await this.competitions.upsert(data, { conflictPaths: ['externalRef'] });
    const row = await this.competitions.findOne({
      where: { externalRef: data.externalRef },
    });
    return row!.id;
  }

  async upsertTeam(data: {
    externalRef: string;
    name: string;
    country: string | null;
  }): Promise<string> {
    await this.teams.upsert(data, { conflictPaths: ['externalRef'] });
    const row = await this.teams.findOne({
      where: { externalRef: data.externalRef },
    });
    return row!.id;
  }

  async upsertPlayer(data: {
    externalRef: string;
    name: string;
  }): Promise<string> {
    await this.players.upsert(data, { conflictPaths: ['externalRef'] });
    const row = await this.players.findOne({
      where: { externalRef: data.externalRef },
    });
    return row!.id;
  }

  async upsertReferee(name: string): Promise<string> {
    await this.referees.upsert({ name }, { conflictPaths: ['name'] });
    const row = await this.referees.findOne({ where: { name } });
    return row!.id;
  }

  async upsertMatch(data: {
    externalRef: string;
    competitionId: string;
    homeTeamId: string;
    awayTeamId: string;
    refereeId: string | null;
    season: string;
    round: string | null;
    kickoffAt: Date;
    status: MatchStatus;
    elapsed?: number | null;
  }): Promise<string> {
    await this.matches.upsert(data, { conflictPaths: ['externalRef'] });
    const row = await this.matches.findOne({
      where: { externalRef: data.externalRef },
    });
    return row!.id;
  }

  /** Substitui todos os eventos de uma partida (idempotência por match_id). */
  async replaceMatchEvents(
    matchId: string,
    events: Array<Omit<MatchEvent, 'id' | 'createdAt'>>,
  ): Promise<number> {
    await this.matchEvents.delete({ matchId });
    if (events.length === 0) return 0;
    await this.matchEvents.insert(events);
    return events.length;
  }

  /** Mapa code -> id do catálogo de tipos de evento. */
  async eventTypeMap(): Promise<Record<string, string>> {
    const rows = await this.eventTypes.find();
    return rows.reduce<Record<string, string>>((acc, r) => {
      acc[r.code] = r.id;
      return acc;
    }, {});
  }
}
