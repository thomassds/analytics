import { Injectable } from '@nestjs/common';
import {
  LeagueAverages,
  MarketKey,
  MarketRating,
  TeamRatings,
} from '../repositories/analytics.repository';
import { CdfPoint, Distribution } from './distribution.service';
import { MarketMetrics } from './metric.service';

const Z = 1.96; // 95%

/** Todos os mercados que o modelo prevê. */
const MARKETS: MarketKey[] = [
  'goals',
  'totalCards',
  'yellowCards',
  'redCards',
  'weighted',
  'shots',
  'shotsOnGoal',
  'corners',
  'fouls',
  'offsides',
  'saves',
];

export interface ModeledMatch {
  home: MarketMetrics;
  away: MarketMetrics;
  total: MarketMetrics;
  bothTeamsScore: number; // P(ambos marcam)
}

/**
 * Modelo de força relativa (estilo Poisson / Dixon-Coles) com AJUSTE DE ADVERSÁRIO.
 *
 * A média histórica de um time é "contra adversário médio"; somá-la crua
 * superestima confrontos forte×forte e subestima fraco×fraco. Aqui:
 *
 *   λ_casa = μ × ataque_casa × defesa_fora
 * onde ataque = (produzido / μ) e defesa = (sofrido pelo adversário / μ), ambos
 * com SHRINKAGE para 1 (média da liga) proporcional ao tamanho da amostra — poucos
 * jogos puxam a taxa de volta pra média, evitando extremos de ruído.
 *
 * Cada lado vira uma Poisson(λ); o total da partida é Poisson(λ_casa+λ_fora)
 * (soma de Poissons independentes). A Poisson dá variância = média, corrigindo a
 * subestimação de variância da antiga convolução empírica com independência.
 */
@Injectable()
export class OpponentModelService {
  /** Peso do prior (jogos "virtuais" na média da liga) para o shrinkage. */
  private readonly K = 5;

  build(
    home: TeamRatings,
    away: TeamRatings,
    league: LeagueAverages,
  ): ModeledMatch {
    const homeM = {} as MarketMetrics;
    const awayM = {} as MarketMetrics;
    const totalM = {} as MarketMetrics;

    for (const mk of MARKETS) {
      const mu = league[mk];
      const lamHome = this.lambda(home[mk], away[mk], mu);
      const lamAway = this.lambda(away[mk], home[mk], mu);
      const nHome = home[mk].games;
      const nAway = away[mk].games;
      homeM[mk] = this.poisson(lamHome, nHome);
      awayM[mk] = this.poisson(lamAway, nAway);
      totalM[mk] = this.poisson(lamHome + lamAway, Math.min(nHome, nAway));
    }

    const lamHG = this.lambda(home.goals, away.goals, league.goals);
    const lamAG = this.lambda(away.goals, home.goals, league.goals);
    const bothTeamsScore =
      Math.round((1 - Math.exp(-lamHG)) * (1 - Math.exp(-lamAG)) * 1000) / 1000;

    return { home: homeM, away: awayM, total: totalM, bothTeamsScore };
  }

  /** λ = μ × taxa_ataque(atacante) × taxa_defesa(defensor), com shrinkage. */
  private lambda(
    attacker: MarketRating,
    defender: MarketRating,
    mu: number,
  ): number {
    if (mu <= 0) return 0;
    const attack = this.shrink(attacker.for / mu, attacker.games);
    const concede = this.shrink(defender.against / mu, defender.games);
    return mu * attack * concede;
  }

  /** Puxa a taxa bruta para 1 (média da liga) conforme a amostra é pequena. */
  private shrink(rawRate: number, n: number): number {
    if (!Number.isFinite(rawRate) || rawRate < 0) return 1;
    return (n * rawRate + this.K) / (n + this.K);
  }

  /** Distribuição Poisson(λ) como Distribution (perGame, mean, cdf + Wilson). */
  private poisson(lambda: number, games: number): Distribution {
    const lam = Number.isFinite(lambda) && lambda > 0 ? lambda : 0;
    // cauda suficiente para cobrir ~toda a massa
    const kMax = Math.min(
      200,
      Math.max(6, Math.ceil(lam + 12 * Math.sqrt(lam + 1) + 6)),
    );
    // pmf iterativa: p0 = e^-λ; p_k = p_{k-1}·λ/k
    const pmf: number[] = [];
    let p = Math.exp(-lam);
    pmf[0] = p;
    for (let k = 1; k <= kMax; k++) {
      p = (p * lam) / k;
      pmf[k] = p;
    }

    // frequências esperadas (pmf × amostra) só para o histograma ilustrativo da UI —
    // inteiras, senão apareceriam contagens fracionárias de "jogos".
    const effN = Math.max(1, games);
    const perGame: Record<number, number> = {};
    for (let k = 0; k <= kMax; k++) {
      const c = Math.round(pmf[k] * games);
      if (c > 0) perGame[k] = c;
    }

    const cdf: CdfPoint[] = [];
    let cum = 0; // P(X ≤ k-1) acumulado
    for (let k = 1; k <= kMax + 1; k++) {
      cum += pmf[k - 1] ?? 0;
      const pUnder = Math.min(1, cum); // P(X < k)
      const [low, high] = this.wilson(pUnder, effN);
      cdf.push({
        value: k,
        pUnder: this.round(pUnder),
        wilsonLow: this.round(low),
        wilsonHigh: this.round(high),
      });
      if (pUnder > 0.99995) break; // corta a cauda irrelevante
    }

    return { sampleSize: games, perGame, mean: this.round(lam), cdf };
  }

  /** Intervalo de Wilson (95%) para uma proporção p com n observações. */
  private wilson(pp: number, n: number): [number, number] {
    const p = Math.min(1, Math.max(0, pp));
    const z2 = Z * Z;
    const denom = 1 + z2 / n;
    const center = (p + z2 / (2 * n)) / denom;
    const margin =
      (Z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
    return [Math.max(0, center - margin), Math.min(1, center + margin)];
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }
}
