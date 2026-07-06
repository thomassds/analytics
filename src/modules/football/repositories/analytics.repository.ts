import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, MatchStatus } from '../entities/match.entity';

export interface PerMatchCardCounts {
  yellow: number;
  red: number;
  second: number;
}

export interface PerMatchTeamStats {
  shots: number | null;
  onGoal: number | null;
  corners: number | null;
  fouls: number | null;
  offsides: number | null;
  saves: number | null;
}

export type MatchPeriod = 'first' | 'second';

/** Valores REALIZADOS do jogo por mercado (pra comparar com a previsão). */
export interface MatchActuals {
  goals: number;
  totalCards: number;
  yellowCards: number;
  redCards: number;
  weighted: number;
  shots: number | null;
  shotsOnGoal: number | null;
  corners: number | null;
  fouls: number | null;
  offsides: number | null;
  saves: number | null;
  bothTeamsScored: boolean;
}

export interface AnalyticsFilter {
  teamId?: string;
  playerId?: string;
  refereeId?: string;
  competitionId?: string;
  period?: MatchPeriod; // recorta eventos por tempo (só cartões/gols têm minuto)
  before?: Date; // corte "as-of": só jogos com kickoff < before (previsão honesta)
}

/** Cláusula SQL do tempo (1º = minuto ≤ 45; 2º = minuto > 45, inclui acréscimos). */
function periodClause(alias: string, period?: MatchPeriod): string {
  if (period === 'first') return `AND ${alias}.minute <= 45`;
  if (period === 'second') return `AND ${alias}.minute > 45`;
  return '';
}

/** Queries de agregação. Denominador = jogos disputados (inclui jogos zero). */
@Injectable()
export class AnalyticsRepository {
  constructor(
    @InjectRepository(Match) private readonly matches: Repository<Match>,
  ) {}

  private get db() {
    return this.matches.manager;
  }

  /**
   * O que REALMENTE saiu no jogo, por mercado (só finalizados). Cartões/gols
   * respeitam o período; chutes/escanteios/etc. são do jogo todo (agregado).
   */
  async getMatchActuals(
    matchId: string,
    period?: MatchPeriod,
  ): Promise<MatchActuals | null> {
    const match = await this.getMatchById(matchId);
    // finalizado → resultado; ao vivo → parcial. Agendado/cancelado → nada.
    if (
      !match ||
      (match.status !== MatchStatus.FINISHED &&
        match.status !== MatchStatus.IN_PROGRESS)
    )
      return null;

    const pc = periodClause('me', period);
    const evRows = await this.db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN et.code='GOAL' THEN 1 ELSE 0 END),0)::int AS goals,
         COALESCE(SUM(CASE WHEN et.code='YELLOW_CARD' THEN 1 ELSE 0 END),0)::int AS yellow,
         COALESCE(SUM(CASE WHEN et.code='RED_CARD' THEN 1 ELSE 0 END),0)::int AS red,
         COALESCE(SUM(CASE WHEN et.code='SECOND_YELLOW' THEN 1 ELSE 0 END),0)::int AS "second",
         COALESCE(SUM(CASE WHEN et.code='GOAL' AND me.team_id = $2 THEN 1 ELSE 0 END),0)::int AS "homeGoals",
         COALESCE(SUM(CASE WHEN et.code='GOAL' AND me.team_id = $3 THEN 1 ELSE 0 END),0)::int AS "awayGoals"
       FROM match_events me
       JOIN event_types et ON et.id = me.event_type_id
       WHERE me.match_id = $1 ${pc}`,
      [matchId, match.homeTeamId, match.awayTeamId],
    );
    const ev = evRows[0];

    const stRows = await this.db.query(
      `SELECT count(*)::int AS n,
              SUM(total_shots)::int AS shots, SUM(shots_on_goal)::int AS "onGoal",
              SUM(corner_kicks)::int AS corners, SUM(fouls)::int AS fouls,
              SUM(offsides)::int AS offsides, SUM(goalkeeper_saves)::int AS saves
       FROM match_stats WHERE match_id = $1`,
      [matchId],
    );
    const st = stRows[0];
    const hasStats = Number(st.n) > 0;
    const stat = (v: any): number | null =>
      hasStats && v != null ? Number(v) : null;

    const yellow = Number(ev.yellow);
    const red = Number(ev.red);
    const second = Number(ev.second);

    return {
      goals: Number(ev.goals),
      totalCards: yellow + red + second,
      yellowCards: yellow + second,
      redCards: red + second,
      weighted: yellow + second + red * 2,
      shots: stat(st.shots),
      shotsOnGoal: stat(st.onGoal),
      corners: stat(st.corners),
      fouls: stat(st.fouls),
      offsides: stat(st.offsides),
      saves: stat(st.saves),
      bothTeamsScored: Number(ev.homeGoals) > 0 && Number(ev.awayGoals) > 0,
    };
  }

  /** Congela a previsão (payload) de um jogo. Idempotente (atualiza se existir). */
  async upsertSnapshot(matchId: string, payload: unknown): Promise<void> {
    await this.db.query(
      `INSERT INTO match_analysis (match_id, payload, captured_at)
       VALUES ($1, $2, now())
       ON CONFLICT (match_id) DO UPDATE
         SET payload = EXCLUDED.payload, captured_at = now()`,
      [matchId, JSON.stringify(payload)],
    );
  }

  async getSnapshotCapturedAt(matchId: string): Promise<Date | null> {
    const rows = await this.db.query(
      `SELECT captured_at FROM match_analysis WHERE match_id = $1`,
      [matchId],
    );
    return rows[0]?.captured_at ?? null;
  }

  async getMatchById(id: string): Promise<Match | null> {
    return this.matches.findOne({ where: { id } });
  }

  async getRefereeName(id: string): Promise<string | null> {
    const rows = await this.db.query('SELECT name FROM referees WHERE id = $1', [
      id,
    ]);
    return rows[0]?.name ?? null;
  }

  /**
   * Contagem de cartões por jogo, para o filtro dado, SOMENTE jogos finalizados.
   * team/player → escopo daquele time/jogador; referee/competition → total da partida.
   * Jogos sem cartão entram com zero (LEFT JOIN).
   */
  async getPerMatchCardCounts(
    filter: AnalyticsFilter,
  ): Promise<PerMatchCardCounts[]> {
    const cardTypes = `(SELECT id FROM event_types WHERE category IN ('yellow','red'))`;
    const agg = `
      COALESCE(SUM(CASE WHEN et.code='YELLOW_CARD' THEN 1 ELSE 0 END),0)::int AS yellow,
      COALESCE(SUM(CASE WHEN et.code='RED_CARD' THEN 1 ELSE 0 END),0)::int AS red,
      COALESCE(SUM(CASE WHEN et.code='SECOND_YELLOW' THEN 1 ELSE 0 END),0)::int AS "second"
    `;
    const finished = MatchStatus.FINISHED;
    const pc = periodClause('me', filter.period);
    // corte as-of: acrescenta `AND m.kickoff_at < $N` empurrando `before` nos params
    const beforeAnd = (p: any[]): string => {
      if (!filter.before) return '';
      p.push(filter.before);
      return `AND m.kickoff_at < $${p.length}`;
    };

    let sql: string;
    let params: any[];

    if (filter.teamId) {
      params = [filter.teamId, finished];
      const bc = beforeAnd(params);
      sql = `
        SELECT ${agg}
        FROM matches m
        LEFT JOIN match_events me ON me.match_id = m.id AND me.team_id = $1
          AND me.event_type_id IN ${cardTypes} ${pc}
        LEFT JOIN event_types et ON et.id = me.event_type_id
        WHERE (m.home_team_id = $1 OR m.away_team_id = $1) AND m.status = $2 ${bc}
        GROUP BY m.id`;
    } else if (filter.playerId) {
      params = [filter.playerId, finished];
      const bc = beforeAnd(params);
      sql = `
        SELECT ${agg}
        FROM matches m
        JOIN (
          SELECT DISTINCT me2.match_id FROM match_events me2
          JOIN event_types et2 ON et2.id = me2.event_type_id
          WHERE me2.player_id = $1 AND et2.category = 'appearance'
        ) app ON app.match_id = m.id
        LEFT JOIN match_events me ON me.match_id = m.id AND me.player_id = $1
          AND me.event_type_id IN ${cardTypes} ${pc}
        LEFT JOIN event_types et ON et.id = me.event_type_id
        WHERE m.status = $2 ${bc}
        GROUP BY m.id`;
    } else if (filter.refereeId) {
      params = [filter.refereeId, finished];
      const bc = beforeAnd(params);
      sql = `
        SELECT ${agg}
        FROM matches m
        LEFT JOIN match_events me ON me.match_id = m.id
          AND me.event_type_id IN ${cardTypes} ${pc}
        LEFT JOIN event_types et ON et.id = me.event_type_id
        WHERE m.referee_id = $1 AND m.status = $2 ${bc}
        GROUP BY m.id`;
    } else if (filter.competitionId) {
      params = [filter.competitionId, finished];
      const bc = beforeAnd(params);
      sql = `
        SELECT ${agg}
        FROM matches m
        LEFT JOIN match_events me ON me.match_id = m.id
          AND me.event_type_id IN ${cardTypes} ${pc}
        LEFT JOIN event_types et ON et.id = me.event_type_id
        WHERE m.competition_id = $1 AND m.status = $2 ${bc}
        GROUP BY m.id`;
    } else {
      // total de cada partida finalizada (sem filtro)
      params = [finished];
      const bc = beforeAnd(params);
      sql = `
        SELECT ${agg}
        FROM matches m
        LEFT JOIN match_events me ON me.match_id = m.id
          AND me.event_type_id IN ${cardTypes} ${pc}
        LEFT JOIN event_types et ON et.id = me.event_type_id
        WHERE m.status = $1 ${bc}
        GROUP BY m.id`;
    }

    const rows = await this.db.query(sql, params);
    return rows.map((r: any) => ({
      yellow: Number(r.yellow),
      red: Number(r.red),
      second: Number(r.second),
    }));
  }

  /**
   * Gols marcados pelo time em cada jogo finalizado (de match_events, code=GOAL).
   * Inclui jogos sem gol (LEFT JOIN → 0). Usado p/ o mercado Total de Gols.
   */
  async getPerMatchGoalsFor(
    teamId: string,
    period?: MatchPeriod,
    before?: Date,
  ): Promise<number[]> {
    const goalType = `(SELECT id FROM event_types WHERE code='GOAL')`;
    const pc = periodClause('me', period);
    const params: any[] = [teamId, MatchStatus.FINISHED];
    let bc = '';
    if (before) {
      params.push(before);
      bc = `AND m.kickoff_at < $${params.length}`;
    }
    const rows = await this.db.query(
      `SELECT COALESCE(COUNT(me.id), 0)::int AS goals
       FROM matches m
       LEFT JOIN match_events me ON me.match_id = m.id AND me.team_id = $1
         AND me.event_type_id IN ${goalType} ${pc}
       WHERE (m.home_team_id = $1 OR m.away_team_id = $1) AND m.status = $2 ${bc}
       GROUP BY m.id`,
      params,
    );
    return rows.map((r: any) => Number(r.goals));
  }

  /**
   * Estatísticas por jogo (chutes, chutes ao gol, escanteios) de match_stats.
   * Diferente de cartões: jogo SEM match_stats = dado indisponível (não zero) →
   * INNER JOIN (só entra quem tem estatística). Cada métrica pode faltar
   * isoladamente (fica null e é filtrada na hora de montar a distribuição).
   * team → do próprio time; competition/total → cada time por partida.
   */
  async getPerMatchTeamStats(
    filter: AnalyticsFilter,
  ): Promise<PerMatchTeamStats[]> {
    const finished = MatchStatus.FINISHED;
    const cols = `ms.total_shots AS shots, ms.shots_on_goal AS "onGoal", ms.corner_kicks AS corners,
                  ms.fouls, ms.offsides, ms.goalkeeper_saves AS saves`;
    const hasStat = `(ms.total_shots IS NOT NULL OR ms.corner_kicks IS NOT NULL OR ms.fouls IS NOT NULL)`;

    const beforeAnd = (p: any[]): string => {
      if (!filter.before) return '';
      p.push(filter.before);
      return `AND m.kickoff_at < $${p.length}`;
    };

    let sql: string;
    let params: any[];

    if (filter.teamId) {
      params = [filter.teamId, finished];
      const bc = beforeAnd(params);
      sql = `
        SELECT ${cols}
        FROM matches m
        JOIN match_stats ms ON ms.match_id = m.id AND ms.team_id = $1
        WHERE (m.home_team_id = $1 OR m.away_team_id = $1)
          AND m.status = $2 ${bc} AND ${hasStat}`;
    } else if (filter.competitionId) {
      params = [filter.competitionId, finished];
      const bc = beforeAnd(params);
      sql = `
        SELECT ${cols}
        FROM matches m
        JOIN match_stats ms ON ms.match_id = m.id
        WHERE m.competition_id = $1 AND m.status = $2 ${bc} AND ${hasStat}`;
    } else {
      params = [finished];
      const bc = beforeAnd(params);
      sql = `
        SELECT ${cols}
        FROM matches m
        JOIN match_stats ms ON ms.match_id = m.id
        WHERE m.status = $1 ${bc} AND ${hasStat}`;
    }

    const rows = await this.db.query(sql, params);
    const num = (v: any): number | null => (v == null ? null : Number(v));
    return rows.map((r: any) => ({
      shots: num(r.shots),
      onGoal: num(r.onGoal),
      corners: num(r.corners),
      fouls: num(r.fouls),
      offsides: num(r.offsides),
      saves: num(r.saves),
    }));
  }
}
