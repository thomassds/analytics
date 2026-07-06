import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from '../entities/match.entity';
import { leagueLogoUrl, teamLogoUrl } from '../media';

export interface CompetitionListItem {
  id: string;
  name: string;
  season: string;
}

export interface LeagueListItem {
  id: string;
  name: string;
  country: string | null;
  logoUrl: string | null;
  matchCount: number;
  seasonCount: number;
  /** Ano quando a liga tem uma única edição no escopo (senão null). */
  season: string | null;
}

export interface SeasonListItem {
  competitionId: string;
  season: string;
  matchCount: number;
}

export interface TeamRef {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface MatchListItem {
  id: string;
  kickoffAt: Date;
  status: number;
  round: string | null;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  competition: { id: string; name: string; season: string };
}

/** Leituras de catálogo (competições e partidas) para a listagem do front. */
@Injectable()
export class CatalogRepository {
  constructor(
    @InjectRepository(Match) private readonly matches: Repository<Match>,
  ) {}

  private get db() {
    return this.matches.manager;
  }

  async listCompetitions(): Promise<CompetitionListItem[]> {
    return this.db.query(
      `SELECT id, name, season FROM competitions ORDER BY name ASC`,
    );
  }

  /**
   * Ligas que possuem jogos no escopo, para o filtro da home. Ordenadas pela
   * partida mais relevante: no escopo "upcoming" pela mais próxima; em "past"
   * pela mais recente. Colapsa as temporadas (uma linha por liga).
   */
  async listLeagues(scope?: 'upcoming' | 'past'): Promise<LeagueListItem[]> {
    const matchCond =
      scope === 'upcoming'
        ? `AND m.status IN (0, 1) AND m.kickoff_at >= now() - interval '6 hours'`
        : scope === 'past'
          ? 'AND m.status = 2'
          : '';
    // relevância: próximo mais cedo (MIN futuro) vs passado mais recente (MAX).
    const relevance =
      scope === 'upcoming' ? 'MIN(m.kickoff_at)' : 'MAX(m.kickoff_at)';
    const relOrder = scope === 'upcoming' ? 'ASC' : 'DESC';

    return this.db.query(
      `SELECT l.id, l.name, l.country, l.external_ref AS "externalRef",
              COUNT(m.id)::int AS "matchCount",
              COUNT(DISTINCT c.season)::int AS "seasonCount",
              MAX(c.season) AS "maxSeason"
       FROM leagues l
       JOIN competitions c ON c.league_id = l.id
       JOIN matches m ON m.competition_id = c.id ${matchCond}
       GROUP BY l.id, l.name, l.country, l.external_ref
       ORDER BY ${relevance} ${relOrder}`,
    ).then((rows: any[]) =>
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        country: r.country ?? null,
        logoUrl: leagueLogoUrl(r.externalRef),
        matchCount: r.matchCount,
        seasonCount: r.seasonCount,
        season: r.seasonCount === 1 ? r.maxSeason : null,
      })),
    );
  }

  /** Edições (temporadas) de uma liga que têm jogos no escopo, mais recentes 1º. */
  async listLeagueSeasons(
    leagueId: string,
    scope?: 'upcoming' | 'past',
  ): Promise<SeasonListItem[]> {
    const matchCond =
      scope === 'upcoming'
        ? `AND m.status IN (0, 1) AND m.kickoff_at >= now() - interval '6 hours'`
        : scope === 'past'
          ? 'AND m.status = 2'
          : '';
    return this.db
      .query(
        `SELECT c.id AS "competitionId", c.season,
                COUNT(m.id)::int AS "matchCount"
         FROM competitions c
         JOIN matches m ON m.competition_id = c.id ${matchCond}
         WHERE c.league_id = $1
         GROUP BY c.id, c.season
         HAVING COUNT(m.id) > 0
         ORDER BY c.season DESC`,
        [leagueId],
      )
      .then((rows: any[]) =>
        rows.map((r) => ({
          competitionId: r.competitionId,
          season: r.season,
          matchCount: r.matchCount,
        })),
      );
  }

  async listMatches(opts: {
    competitionId?: string;
    leagueId?: string;
    scope?: 'upcoming' | 'past';
    page?: number;
    limit?: number;
  }): Promise<{ items: MatchListItem[]; total: number }> {
    const conds: string[] = [];
    const params: any[] = [];
    if (opts.competitionId) {
      params.push(opts.competitionId);
      conds.push(`m.competition_id = $${params.length}`);
    }
    if (opts.leagueId) {
      params.push(opts.leagueId);
      conds.push(`c.league_id = $${params.length}`);
    }
    // Próximos: não-finalizado E com bola rolando ou por vir (kickoff futuro, com
    // folga p/ jogo ao vivo). Isso exclui cancelados/adiados antigos (ex.: NK 2021,
    // Spartak 2022) que ficavam presos como "Agendado" no topo da lista.
    if (opts.scope === 'upcoming')
      conds.push(`m.status IN (0, 1) AND m.kickoff_at >= now() - interval '6 hours'`);
    else if (opts.scope === 'past') conds.push(`m.status = 2`);
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    // JOIN em competitions só é necessário quando filtramos por liga.
    const compJoin = opts.leagueId
      ? 'JOIN competitions c ON c.id = m.competition_id'
      : '';
    // próximos: mais perto primeiro (ASC); passados: mais recente primeiro (DESC)
    const order = opts.scope === 'upcoming' ? 'ASC' : 'DESC';

    const totalRow = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM matches m ${compJoin} ${where}`,
      params,
    );
    const total = totalRow[0]?.total ?? 0;

    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const pageParams = [...params, limit, (page - 1) * limit];

    const rows = await this.db.query(
      `SELECT
         m.id, m.kickoff_at AS "kickoffAt", m.status, m.round,
         ht.id AS "homeTeamId", ht.name AS "homeTeamName",
         ht.external_ref AS "homeTeamRef", at.external_ref AS "awayTeamRef",
         at.id AS "awayTeamId", at.name AS "awayTeamName",
         c.id AS "competitionId", c.name AS "competitionName", c.season AS "competitionSeason"
       FROM matches m
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       JOIN competitions c ON c.id = m.competition_id
       ${where}
       ORDER BY m.kickoff_at ${order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      pageParams,
    );

    const items = rows.map((r: any) => ({
      id: r.id,
      kickoffAt: r.kickoffAt,
      status: Number(r.status),
      round: r.round ?? null,
      homeTeam: {
        id: r.homeTeamId,
        name: r.homeTeamName,
        logoUrl: teamLogoUrl(r.homeTeamRef),
      },
      awayTeam: {
        id: r.awayTeamId,
        name: r.awayTeamName,
        logoUrl: teamLogoUrl(r.awayTeamRef),
      },
      competition: {
        id: r.competitionId,
        name: r.competitionName,
        season: r.competitionSeason,
      },
    }));
    return { items, total };
  }

  /** Detalhe de uma partida (para a página de eventos). */
  async getMatchRow(id: string): Promise<any | null> {
    const rows = await this.db.query(
      `SELECT
         m.id, m.kickoff_at AS "kickoffAt", m.status, m.round, m.elapsed,
         ht.id AS "homeTeamId", ht.name AS "homeTeamName", ht.external_ref AS "homeTeamRef",
         at.id AS "awayTeamId", at.name AS "awayTeamName", at.external_ref AS "awayTeamRef",
         c.id AS "competitionId", c.name AS "competitionName",
         r.name AS "refereeName"
       FROM matches m
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       JOIN competitions c ON c.id = m.competition_id
       LEFT JOIN referees r ON r.id = m.referee_id
       WHERE m.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  /** Estatísticas por time da partida (chutes, escanteios). Vazio se sem dados. */
  async getMatchStatsRows(id: string): Promise<any[]> {
    return this.db.query(
      `SELECT team_id AS "teamId", total_shots AS "totalShots",
              shots_on_goal AS "shotsOnGoal", corner_kicks AS "cornerKicks",
              fouls, offsides, goalkeeper_saves AS "goalkeeperSaves"
       FROM match_stats
       WHERE match_id = $1`,
      [id],
    );
  }

  /** Eventos da partida, com tipo, time e jogador. */
  async getMatchEventRows(id: string): Promise<any[]> {
    return this.db.query(
      `SELECT
         et.code, et.category, me.minute,
         me.team_id AS "teamId", t.name AS "teamName",
         p.name AS "playerName", p.external_ref AS "playerRef"
       FROM match_events me
       JOIN event_types et ON et.id = me.event_type_id
       JOIN teams t ON t.id = me.team_id
       LEFT JOIN players p ON p.id = me.player_id
       WHERE me.match_id = $1
       ORDER BY me.minute ASC NULLS FIRST, t.name ASC`,
      [id],
    );
  }
}
