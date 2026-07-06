import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { SyncFootballDataUseCase } from '../modules/football/ingestion/sync-football-data.use-case';

/**
 * Sincroniza a Copa do Mundo (API-Football league=1) uma vez.
 * Uso: yarn sync:worldcup [season]   (default 2026)
 */
async function run() {
  const logger = new Logger('SyncWorldCup');
  const season = process.argv[2] ?? '2026';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const sync = app.get(SyncFootballDataUseCase);
    const result = await sync.execute({
      competitionExternalRef: '1', // FIFA World Cup no API-Football
      season,
    });
    logger.log(`Resultado: ${JSON.stringify(result)}`);
  } catch (err: any) {
    logger.error(`Falha na sync: ${err?.message ?? err}`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
