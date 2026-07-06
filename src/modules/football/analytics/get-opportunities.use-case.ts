import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { teamLogoUrl } from '../media';
import { GetMatchSummaryUseCase } from './get-match-summary.use-case';

/** Uma linha de aposta no "ponto doce" (sem info do jogo). */
export interface MatchOpportunity {
  market: string; // chave (goals, totalCards, corners…)
  side: 'under' | 'over'; // menos / mais
  threshold: number; // X.5
  prob: number; // nossa probabilidade
  safeProb: number; // piso conservador (Wilson)
  minOdd: number; // odd mínima que compensa = 1/safeProb
  sampleSize: number; // nº de jogos que embasam (confiança)
}

/** Oportunidade no feed (linha + o jogo a que pertence). */
export interface Opportunity extends MatchOpportunity {
  matchId: string;
  kickoffAt: string;
  competition: string;
  home: { name: string; logoUrl: string | null };
  away: { name: string; logoUrl: string | null };
}

// Ponto doce: seguro (piso Wilson ∈ 60–70%) E que ainda paga decente (odd mín 1,43–1,67).
const SAFE_MIN = 0.6; // 1/0,60 ≈ 1,67
const SAFE_MAX = 0.7; // 1/0,70 ≈ 1,43
const SAFE_CENTER = 0.65; // meio da faixa → odd ≈ 1,54 (equilíbrio seguro × paga)
const MIN_SAMPLE = 8; // evita ruído de amostra pequena

// mercados escaneados (pula 'weighted', que é interno)
const MARKETS = [
  'goals',
  'totalCards',
  'yellowCards',
  'redCards',
  'shots',
  'shotsOnGoal',
  'corners',
  'fouls',
  'offsides',
  'saves',
];

/**
 * Extrai as linhas no ponto doce de um mapa de métricas (o matchTotal.metrics de
 * uma partida) e as ordena pelo equilíbrio (proximidade do centro da faixa),
 * desempatando por mais amostra. Fonte única da definição de "oportunidade".
 */
function extract(metrics: any): MatchOpportunity[] {
  const out: MatchOpportunity[] = [];
  const consider = (
    market: string,
    side: 'under' | 'over',
    threshold: number,
    prob: number,
    safeProb: number,
    sampleSize: number,
  ): void => {
    // ignora pontos degenerados da cauda (prob 0/1) onde o piso Wilson vira NaN —
    // NaN escapa das comparações (< / >), então checa finitude explicitamente
    if (!Number.isFinite(safeProb) || safeProb < SAFE_MIN || safeProb > SAFE_MAX) {
      return;
    }
    out.push({
      market,
      side,
      threshold,
      prob: Math.round(prob * 1000) / 1000,
      safeProb: Math.round(safeProb * 1000) / 1000,
      minOdd: Math.round((1 / safeProb) * 100) / 100,
      sampleSize,
    });
  };

  for (const market of MARKETS) {
    const dist = metrics?.[market];
    if (!dist || dist.sampleSize < MIN_SAMPLE) continue;
    for (const pt of dist.cdf ?? []) {
      const threshold = pt.value - 0.5;
      // MENOS: p = pUnder, piso = wilsonLow
      consider(market, 'under', threshold, pt.pUnder, pt.wilsonLow, dist.sampleSize);
      // MAIS: p = 1 - pUnder, piso = 1 - wilsonHigh
      consider(market, 'over', threshold, 1 - pt.pUnder, 1 - pt.wilsonHigh, dist.sampleSize);
    }
  }

  out.sort(
    (a, b) =>
      Math.abs(a.safeProb - SAFE_CENTER) - Math.abs(b.safeProb - SAFE_CENTER) ||
      b.sampleSize - a.sampleSize,
  );
  return out;
}

@Injectable()
export class GetOpportunitiesUseCase {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly summary: GetMatchSummaryUseCase,
  ) {}

  /** Feed global: varre os snapshots congelados dos jogos que vêm. */
  async execute(limit = 40): Promise<Opportunity[]> {
    const rows: any[] = await this.ds.query(
      `SELECT ma.payload, m.id AS match_id, m.kickoff_at,
              ht.name AS h_name, ht.external_ref AS h_ref,
              at.name AS a_name, at.external_ref AS a_ref,
              cc.name AS comp
       FROM match_analysis ma
       JOIN matches m ON m.id = ma.match_id
       JOIN competitions cc ON cc.id = m.competition_id
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       WHERE m.status = 0`,
    );

    const out: Opportunity[] = [];
    for (const r of rows) {
      const base = {
        matchId: r.match_id,
        kickoffAt: new Date(r.kickoff_at).toISOString(),
        competition: r.comp,
        home: { name: r.h_name, logoUrl: teamLogoUrl(r.h_ref) },
        away: { name: r.a_name, logoUrl: teamLogoUrl(r.a_ref) },
      };
      for (const opp of extract(r.payload?.matchTotal?.metrics)) {
        out.push({ ...opp, ...base });
      }
    }

    out.sort(
      (a, b) =>
        Math.abs(a.safeProb - SAFE_CENTER) - Math.abs(b.safeProb - SAFE_CENTER) ||
        b.sampleSize - a.sampleSize,
    );
    return out.slice(0, limit);
  }

  /** Oportunidades de UMA partida (mesma análise que a aba "Análise" mostra). */
  async executeForMatch(matchId: string): Promise<MatchOpportunity[]> {
    const summary = await this.summary.execute(matchId);
    if (!summary.matchTotal) return [];
    return extract(summary.matchTotal.metrics);
  }
}
