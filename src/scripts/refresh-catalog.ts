import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RefreshLeagueCatalogUseCase } from '../modules/football/ingestion/refresh-league-catalog.use-case';

/** Popula/atualiza o catálogo de ligas de /leagues. Uso: yarn catalog:refresh */
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const r = await app.get(RefreshLeagueCatalogUseCase).execute();
    console.log('Catálogo:', JSON.stringify(r));
  } catch (err: any) {
    console.error('Falha:', err?.message ?? err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
