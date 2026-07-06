import { Injectable, Logger } from '@nestjs/common';
import { LeagueCatalogRepository } from '../repositories/league-catalog.repository';
import { SyncFootballDataUseCase } from './sync-football-data.use-case';

/**
 * Ingestão dirigida pelo catálogo: sincroniza as ligas com ingest_enabled,
 * respeitando o cutoff (seleções ≥ 2016, clubes ≥ 2020) e a cobertura.
 * Substitui a lista hardcoded do backfill.
 */
@Injectable()
export class IngestEnabledLeaguesUseCase {
  private readonly logger = new Logger(IngestEnabledLeaguesUseCase.name);

  constructor(
    private readonly catalog: LeagueCatalogRepository,
    private readonly sync: SyncFootballDataUseCase,
  ) {}

  async execute(scope: 'all' | 'club' | 'national' = 'all'): Promise<void> {
    const targets = await this.catalog.getIngestTargets(scope);
    this.logger.log(
      `Alvos: ${targets.length} ligas habilitadas (escopo=${scope}).`,
    );

    for (const t of targets) {
      for (const season of t.seasons) {
        try {
          const r = await this.sync.execute({
            competitionExternalRef: t.leagueRef,
            season: String(season),
          });
          this.logger.log(`[OK] ${t.leagueName} ${season}: ${JSON.stringify(r)}`);
        } catch (err: any) {
          this.logger.error(
            `[FALHOU] ${t.leagueName} ${season}: ${err?.message ?? err}`,
          );
        }
      }
    }
    this.logger.log('Ingestão do catálogo concluída.');
  }
}
