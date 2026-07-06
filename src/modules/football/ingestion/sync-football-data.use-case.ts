import { Inject, Injectable, Logger } from '@nestjs/common';
import { IngestionRepository } from '../repositories/ingestion.repository';
import { MatchStatus } from '../entities/match.entity';
import {
  IMatchStatsProvider,
  MATCH_STATS_PROVIDER,
  RawProviderMatch,
} from './provider/match-stats-provider';

export interface SyncResult {
  fixtures: number;
  matchesUpserted: number;
  eventsInserted: number;
}

/**
 * Sincroniza uma competição/temporada: Land (cru, no provider) + Map (domínio).
 * Idempotente por external_ref e por match_id.
 */
@Injectable()
export class SyncFootballDataUseCase {
  private readonly logger = new Logger(SyncFootballDataUseCase.name);

  constructor(
    @Inject(MATCH_STATS_PROVIDER)
    private readonly provider: IMatchStatsProvider,
    private readonly repo: IngestionRepository,
  ) {}

  async execute(input: {
    competitionExternalRef: string;
    season: string;
  }): Promise<SyncResult> {
    const raw = await this.provider.fetchMatches(input);
    const eventTypes = await this.repo.eventTypeMap();

    let eventsInserted = 0;
    for (const match of raw) {
      const matchId = await this.mapMatch(match);
      if (match.status === 'finished') {
        eventsInserted += await this.mapEvents(match, matchId, eventTypes);
        await this.mapStats(match, matchId);
      }
    }

    const result: SyncResult = {
      fixtures: raw.length,
      matchesUpserted: raw.length,
      eventsInserted,
    };
    this.logger.log(`sync done: ${JSON.stringify(result)}`);
    return result;
  }

  private async mapMatch(match: RawProviderMatch): Promise<string> {
    const competitionId = await this.repo.upsertCompetition({
      // liga + temporada — evita colapsar edições (ex.: World Cup 2022 vs 2026)
      externalRef: `${match.competitionExternalRef}-${match.season}`,
      name: match.competitionName,
      season: match.season,
    });
    const homeTeamId = await this.repo.upsertTeam(match.home);
    const awayTeamId = await this.repo.upsertTeam(match.away);
    const refereeId = match.refereeName
      ? await this.repo.upsertReferee(match.refereeName)
      : null;

    return this.repo.upsertMatch({
      externalRef: match.externalRef,
      competitionId,
      homeTeamId,
      awayTeamId,
      refereeId,
      season: match.season,
      round: match.round,
      kickoffAt: match.kickoffAt,
      status: this.statusToEnum(match.status),
      elapsed: match.elapsed ?? null,
    });
  }

  /**
   * Sincroniza UM jogo (usado pelo ao vivo): sempre mapeia eventos+stats (não só
   * quando finalizado). Idempotente. Devolve o id interno.
   */
  async syncSingleMatch(match: RawProviderMatch): Promise<string> {
    const matchId = await this.mapMatch(match);
    const eventTypes = await this.repo.eventTypeMap();
    if (match.events.length > 0)
      await this.mapEvents(match, matchId, eventTypes);
    if (match.stats.length > 0) await this.mapStats(match, matchId);
    return matchId;
  }

  private async mapEvents(
    match: RawProviderMatch,
    matchId: string,
    eventTypes: Record<string, string>,
  ): Promise<number> {
    // Mapa externalRef -> id dos dois times da partida.
    const teamRefToId: Record<string, string> = {
      [match.home.externalRef]: await this.repo.upsertTeam(match.home),
      [match.away.externalRef]: await this.repo.upsertTeam(match.away),
    };

    const rows: Array<{
      matchId: string;
      eventTypeId: string;
      teamId: string;
      playerId: string | null;
      minute: number | null;
    }> = [];
    for (const ev of match.events) {
      const eventTypeId = eventTypes[ev.typeCode];
      const teamId = teamRefToId[ev.teamExternalRef];
      if (!eventTypeId || !teamId) continue; // sem de-para/time: ignora

      let playerId: string | null = null;
      if (ev.playerExternalRef) {
        playerId = await this.repo.upsertPlayer({
          externalRef: ev.playerExternalRef,
          name: ev.playerName ?? 'Unknown',
        });
      }

      rows.push({ matchId, eventTypeId, teamId, playerId, minute: ev.minute });
    }

    return this.repo.replaceMatchEvents(matchId, rows as any);
  }

  private async mapStats(
    match: RawProviderMatch,
    matchId: string,
  ): Promise<void> {
    if (!match.stats?.length) return;
    const teamRefToId: Record<string, string> = {
      [match.home.externalRef]: await this.repo.upsertTeam(match.home),
      [match.away.externalRef]: await this.repo.upsertTeam(match.away),
    };
    const rows: Array<{
      matchId: string;
      teamId: string;
      totalShots: number | null;
      shotsOnGoal: number | null;
      cornerKicks: number | null;
      fouls: number | null;
      offsides: number | null;
      goalkeeperSaves: number | null;
    }> = [];
    for (const s of match.stats) {
      const teamId = teamRefToId[s.teamExternalRef];
      if (!teamId) continue;
      rows.push({
        matchId,
        teamId,
        totalShots: s.totalShots,
        shotsOnGoal: s.shotsOnGoal,
        cornerKicks: s.cornerKicks,
        fouls: s.fouls,
        offsides: s.offsides,
        goalkeeperSaves: s.goalkeeperSaves,
      });
    }
    await this.repo.replaceMatchStats(matchId, rows as any);
  }

  private statusToEnum(status: RawProviderMatch['status']): MatchStatus {
    if (status === 'finished') return MatchStatus.FINISHED;
    if (status === 'in_progress') return MatchStatus.IN_PROGRESS;
    if (status === 'cancelled') return MatchStatus.CANCELLED;
    return MatchStatus.SCHEDULED;
  }
}
