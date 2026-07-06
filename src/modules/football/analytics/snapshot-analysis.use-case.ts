import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { GetMatchSummaryUseCase } from './get-match-summary.use-case';

/**
 * Congela a análise (previsão as-of kickoff) de um jogo no banco. Para jogos
 * finalizados, o snapshot é o backtest (só usa histórico anterior ao jogo);
 * para os que vão acontecer, deve rodar perto do apito.
 */
@Injectable()
export class SnapshotAnalysisUseCase {
  constructor(
    private readonly summary: GetMatchSummaryUseCase,
    private readonly repo: AnalyticsRepository,
  ) {}

  async execute(matchId: string): Promise<void> {
    const summary = await this.summary.execute(matchId);
    // guarda só a previsão (o resultado é derivável do jogo a qualquer momento)
    const { result, capturedAt, ...prediction } = summary;
    void result;
    void capturedAt;
    await this.repo.upsertSnapshot(matchId, prediction);
  }
}
