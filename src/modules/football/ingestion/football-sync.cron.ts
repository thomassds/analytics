import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RefreshLeagueCatalogUseCase } from './refresh-league-catalog.use-case';

/**
 * Cron diário: atualiza o catálogo de ligas (descobre liga/temporada nova).
 * É barato (1 request). Gated por CATALOG_REFRESH_ENABLED=true.
 * A ingestão de JOGOS é pesada e roda por script (yarn sync:enabled / backfill).
 */
@Injectable()
export class FootballSyncCron {
  private readonly logger = new Logger(FootballSyncCron.name);

  constructor(
    private readonly config: ConfigService,
    private readonly refreshCatalog: RefreshLeagueCatalogUseCase,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM, { name: 'league-catalog-refresh' })
  async handleDailyCatalog(): Promise<void> {
    if (this.config.get<string>('CATALOG_REFRESH_ENABLED') !== 'true') {
      this.logger.debug('Cron do catálogo desabilitado (CATALOG_REFRESH_ENABLED != true).');
      return;
    }
    this.logger.log('Atualizando catálogo de ligas…');
    try {
      const r = await this.refreshCatalog.execute();
      this.logger.log(`Catálogo atualizado: ${JSON.stringify(r)}`);
    } catch (err: any) {
      this.logger.error(`Refresh do catálogo falhou: ${err?.message ?? err}`);
    }
  }
}
