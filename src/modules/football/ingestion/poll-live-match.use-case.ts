import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  IMatchStatsProvider,
  MATCH_STATS_PROVIDER,
  RawProviderMatch,
} from './provider/match-stats-provider';
import { SyncFootballDataUseCase } from './sync-football-data.use-case';

/**
 * Atualiza UM jogo ao vivo: busca o estado atual no provider (status, minuto,
 * eventos, stats) e reaplica no domínio. Idempotente. As transições de status
 * (scheduled → in_progress → finished) saem naturalmente do que a API devolve.
 */
@Injectable()
export class PollLiveMatchUseCase {
  private readonly logger = new Logger(PollLiveMatchUseCase.name);

  constructor(
    @Inject(MATCH_STATS_PROVIDER)
    private readonly provider: IMatchStatsProvider,
    private readonly sync: SyncFootballDataUseCase,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  async execute(
    matchId: string,
  ): Promise<{ status: string; elapsed: number | null } | null> {
    const rows = await this.ds.query(
      `SELECT m.external_ref AS fixture_ref, m.round, m.kickoff_at,
              l.external_ref AS league_ref, cc.season, cc.name AS comp_name,
              ht.external_ref AS home_ref, ht.name AS home_name, ht.country AS home_country,
              at.external_ref AS away_ref, at.name AS away_name, at.country AS away_country,
              r.name AS referee_name
       FROM matches m
       JOIN competitions cc ON cc.id = m.competition_id
       JOIN leagues l ON l.id = cc.league_id
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       LEFT JOIN referees r ON r.id = m.referee_id
       WHERE m.id = $1`,
      [matchId],
    );
    const m = rows[0];
    if (!m) return null;

    const live = await this.provider.fetchLiveFixture(String(m.fixture_ref));

    const raw: RawProviderMatch = {
      externalRef: String(m.fixture_ref),
      competitionExternalRef: String(m.league_ref),
      competitionName: m.comp_name,
      season: String(m.season),
      round: m.round ?? null,
      kickoffAt: new Date(m.kickoff_at),
      status: live.status,
      elapsed: live.elapsed,
      home: {
        externalRef: String(m.home_ref),
        name: m.home_name,
        country: m.home_country ?? null,
      },
      away: {
        externalRef: String(m.away_ref),
        name: m.away_name,
        country: m.away_country ?? null,
      },
      refereeName: m.referee_name ?? null,
      events: live.events,
      stats: live.stats,
    };

    await this.sync.syncSingleMatch(raw);
    this.logger.log(
      `poll ${matchId}: status=${live.status} elapsed=${live.elapsed} events=${live.events.length}`,
    );
    return { status: live.status, elapsed: live.elapsed };
  }
}
