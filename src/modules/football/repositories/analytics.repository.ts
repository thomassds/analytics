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

/** Força de um time num mercado: média produzida (for) e sofrida (against). */
export interface MarketRating {
  for: number;
  against: number;
  games: number;
}
export type MarketKey =
  | 'goals'
  | 'totalCards'
  | 'yellowCards'
  | 'redCards'
  | 'weighted'
  | 'shots'
  | 'shotsOnGoal'
  | 'corners'
  | 'fouls'
  | 'offsides'
  | 'saves';
export type TeamRatings = Record<MarketKey, MarketRating>;
export type LeagueAverages = Record<MarketKey, number>;

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
    // Só conta jogos cujos eventos foram ingeridos (~43% das partidas vieram só
    // com placar básico, sem eventos). Sem isso, esses jogos entram como "0
    // cartões" falsos e derrubam a média. Todo jogo ingerido tem escalação
    // (category='appearance'), então "tem algum evento" = "foi ingerido".
    const hasEv = `AND EXISTS (SELECT 1 FROM match_events mev WHERE mev.match_id = m.id)`;
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
        WHERE (m.home_team_id = $1 OR m.away_team_id = $1) AND m.status = $2 ${bc} ${hasEv}
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
        WHERE m.referee_id = $1 AND m.status = $2 ${bc} ${hasEv}
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
        WHERE m.competition_id = $1 AND m.status = $2 ${bc} ${hasEv}
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
        WHERE m.status = $1 ${bc} ${hasEv}
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
         AND EXISTS (SELECT 1 FROM match_events mev WHERE mev.match_id = m.id)
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

  /**
   * Força de um time em cada mercado: média produzida (for) e sofrida (against),
   * sobre os jogos finalizados já ingeridos (com corte as-of). Alimenta o modelo
   * de adversário (ataque × defesa). Cartões/gols vêm de match_events; o resto de
   * match_stats (linha do time × linha do adversário).
   */
  async getTeamMarketRatings(
    teamId: string,
    before?: Date,
  ): Promise<TeamRatings> {
    const finished = MatchStatus.FINISHED;
    const N = (v: any): number => (v == null ? 0 : Number(v));

    // corte as-of compartilhado
    const p1: any[] = [teamId, finished];
    let bc1 = '';
    if (before) {
      p1.push(before);
      bc1 = `AND m.kickoff_at < $${p1.length}`;
    }
    const hasEv = `AND EXISTS (SELECT 1 FROM match_events mev WHERE mev.match_id = m.id)`;

    // 1) Cartões (for = do time, against = do adversário) por partida → médias
    const cardSql = `
      WITH per AS (
        SELECT m.id,
          SUM(CASE WHEN me.team_id = $1 AND et.code='YELLOW_CARD'   THEN 1 ELSE 0 END) AS ty,
          SUM(CASE WHEN me.team_id = $1 AND et.code='SECOND_YELLOW' THEN 1 ELSE 0 END) AS ts,
          SUM(CASE WHEN me.team_id = $1 AND et.code='RED_CARD'      THEN 1 ELSE 0 END) AS tr,
          SUM(CASE WHEN me.team_id <> $1 AND et.code='YELLOW_CARD'   THEN 1 ELSE 0 END) AS oy,
          SUM(CASE WHEN me.team_id <> $1 AND et.code='SECOND_YELLOW' THEN 1 ELSE 0 END) AS os,
          SUM(CASE WHEN me.team_id <> $1 AND et.code='RED_CARD'      THEN 1 ELSE 0 END) AS orr
        FROM matches m
        LEFT JOIN match_events me ON me.match_id = m.id
          AND me.event_type_id IN (SELECT id FROM event_types WHERE category IN ('yellow','red'))
        LEFT JOIN event_types et ON et.id = me.event_type_id
        WHERE (m.home_team_id = $1 OR m.away_team_id = $1) AND m.status = $2 ${bc1} ${hasEv}
        GROUP BY m.id)
      SELECT COUNT(*)::int AS games,
        AVG(ty+ts+tr) AS total_for,       AVG(oy+os+orr) AS total_against,
        AVG(ty+ts)    AS yellow_for,      AVG(oy+os)     AS yellow_against,
        AVG(tr+ts)    AS red_for,         AVG(orr+os)    AS red_against,
        AVG(ty+ts+tr*2) AS weighted_for,  AVG(oy+os+orr*2) AS weighted_against
      FROM per`;

    // 2) Gols marcados (for) e sofridos (against)
    const goalSql = `
      WITH per AS (
        SELECT m.id,
          SUM(CASE WHEN me.team_id = $1 THEN 1 ELSE 0 END) AS gf,
          SUM(CASE WHEN me.team_id <> $1 THEN 1 ELSE 0 END) AS ga
        FROM matches m
        LEFT JOIN match_events me ON me.match_id = m.id
          AND me.event_type_id IN (SELECT id FROM event_types WHERE code='GOAL')
        WHERE (m.home_team_id = $1 OR m.away_team_id = $1) AND m.status = $2 ${bc1} ${hasEv}
        GROUP BY m.id)
      SELECT COUNT(*)::int AS games, AVG(gf) AS goals_for, AVG(ga) AS goals_against FROM per`;

    // 3) Chutes/escanteios/etc: linha do time (t) × linha do adversário (o)
    const statSql = `
      SELECT COUNT(*)::int AS games,
        AVG(t.total_shots) AS shots_for,        AVG(o.total_shots) AS shots_against,
        AVG(t.shots_on_goal) AS ong_for,        AVG(o.shots_on_goal) AS ong_against,
        AVG(t.corner_kicks) AS corners_for,     AVG(o.corner_kicks) AS corners_against,
        AVG(t.fouls) AS fouls_for,              AVG(o.fouls) AS fouls_against,
        AVG(t.offsides) AS offsides_for,        AVG(o.offsides) AS offsides_against,
        AVG(t.goalkeeper_saves) AS saves_for,   AVG(o.goalkeeper_saves) AS saves_against
      FROM matches m
      JOIN match_stats t ON t.match_id = m.id AND t.team_id = $1
      JOIN match_stats o ON o.match_id = m.id AND o.team_id <> $1
      WHERE (m.home_team_id = $1 OR m.away_team_id = $1) AND m.status = $2 ${bc1}`;

    const [[c], [g], [s]] = await Promise.all([
      this.db.query(cardSql, p1),
      this.db.query(goalSql, p1),
      this.db.query(statSql, p1),
    ]);

    const cg = N(c?.games);
    const gg = N(g?.games);
    const sg = N(s?.games);
    const rate = (f: any, a: any, games: number): MarketRating => ({
      for: N(f),
      against: N(a),
      games,
    });

    return {
      goals: rate(g?.goals_for, g?.goals_against, gg),
      totalCards: rate(c?.total_for, c?.total_against, cg),
      yellowCards: rate(c?.yellow_for, c?.yellow_against, cg),
      redCards: rate(c?.red_for, c?.red_against, cg),
      weighted: rate(c?.weighted_for, c?.weighted_against, cg),
      shots: rate(s?.shots_for, s?.shots_against, sg),
      shotsOnGoal: rate(s?.ong_for, s?.ong_against, sg),
      corners: rate(s?.corners_for, s?.corners_against, sg),
      fouls: rate(s?.fouls_for, s?.fouls_against, sg),
      offsides: rate(s?.offsides_for, s?.offsides_against, sg),
      saves: rate(s?.saves_for, s?.saves_against, sg),
    };
  }

  /**
   * Médias da liga por mercado = valor médio POR TIME por jogo (baseline μ do
   * modelo). Mesmo universo (jogos ingeridos, as-of). Cartões/gols: total/(2×jogos);
   * stats: AVG direto sobre as linhas de match_stats (cada linha já é um time-jogo).
   */
  async getLeagueMarketAverages(before?: Date): Promise<LeagueAverages> {
    const finished = MatchStatus.FINISHED;
    const N = (v: any): number => (v == null ? 0 : Number(v));
    const p: any[] = [finished];
    let bc = '';
    if (before) {
      p.push(before);
      bc = `AND m.kickoff_at < $${p.length}`;
    }
    const hasEv = `AND EXISTS (SELECT 1 FROM match_events mev WHERE mev.match_id = m.id)`;

    const evSql = `
      SELECT COUNT(DISTINCT m.id)::int AS matches,
        SUM(CASE WHEN et.category IN ('yellow','red') THEN 1 ELSE 0 END) AS cards_total,
        SUM(CASE WHEN et.code IN ('YELLOW_CARD','SECOND_YELLOW') THEN 1 ELSE 0 END) AS cards_yellow,
        SUM(CASE WHEN et.code IN ('RED_CARD','SECOND_YELLOW') THEN 1 ELSE 0 END) AS cards_red,
        SUM(CASE WHEN et.code IN ('YELLOW_CARD','SECOND_YELLOW') THEN 1 WHEN et.code='RED_CARD' THEN 2 ELSE 0 END) AS cards_weighted,
        SUM(CASE WHEN et.code='GOAL' THEN 1 ELSE 0 END) AS goals
      FROM matches m
      LEFT JOIN match_events me ON me.match_id = m.id
      LEFT JOIN event_types et ON et.id = me.event_type_id
      WHERE m.status = $1 ${bc} ${hasEv}`;

    const statSql = `
      SELECT AVG(ms.total_shots) AS shots, AVG(ms.shots_on_goal) AS ong,
             AVG(ms.corner_kicks) AS corners, AVG(ms.fouls) AS fouls,
             AVG(ms.offsides) AS offsides, AVG(ms.goalkeeper_saves) AS saves
      FROM match_stats ms JOIN matches m ON m.id = ms.match_id
      WHERE m.status = $1 ${bc}`;

    const [[e], [s]] = await Promise.all([
      this.db.query(evSql, p),
      this.db.query(statSql, p),
    ]);
    const matches = Math.max(1, N(e?.matches));
    const perTeam = (total: any): number => N(total) / (2 * matches);

    return {
      goals: perTeam(e?.goals),
      totalCards: perTeam(e?.cards_total),
      yellowCards: perTeam(e?.cards_yellow),
      redCards: perTeam(e?.cards_red),
      weighted: perTeam(e?.cards_weighted),
      shots: N(s?.shots),
      shotsOnGoal: N(s?.ong),
      corners: N(s?.corners),
      fouls: N(s?.fouls),
      offsides: N(s?.offsides),
      saves: N(s?.saves),
    };
  }
}
