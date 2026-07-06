import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { IngestEnabledLeaguesUseCase } from '../modules/football/ingestion/ingest-enabled-leagues.use-case';

/**
 * Sincroniza os jogos das ligas habilitadas no catálogo.
 * Uso: yarn sync:enabled [club|national|all]  (default all)
 */
async function run() {
  const arg = (process.argv[2] ?? 'all').toLowerCase();
  const scope: 'all' | 'club' | 'national' =
    arg === 'club' || arg === 'clubs'
      ? 'club'
      : arg === 'national' || arg === 'nacional'
        ? 'national'
        : 'all';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    await app.get(IngestEnabledLeaguesUseCase).execute(scope);
  } catch (err: any) {
    console.error('Falha:', err?.message ?? err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
