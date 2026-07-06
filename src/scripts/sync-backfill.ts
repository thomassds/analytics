import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { SyncFootballDataUseCase } from '../modules/football/ingestion/sync-football-data.use-case';

/**
 * Engorda a base: Copas do Mundo, eliminatórias e campeonatos continentais.
 * Re-sincroniza 2022/2026 para capturar os chutes (match_stats).
 * Roda em 1 contexto Nest; cada competição isola erros. Uso: yarn sync:backfill
 */
const TARGETS: { league: number; season: number; name: string }[] = [
  // Copa do Mundo (2018 novo; 2022/2026 re-sync p/ chutes)
  { league: 1, season: 2018, name: 'World Cup 2018' },
  { league: 1, season: 2022, name: 'World Cup 2022 (re-sync chutes)' },
  { league: 1, season: 2026, name: 'World Cup 2026 (re-sync chutes)' },
  // Copa América
  { league: 9, season: 2016, name: 'Copa America 2016' },
  { league: 9, season: 2019, name: 'Copa America 2019' },
  { league: 9, season: 2021, name: 'Copa America 2021' },
  { league: 9, season: 2024, name: 'Copa America 2024' },
  // Eurocopa
  { league: 4, season: 2016, name: 'Euro 2016' },
  { league: 4, season: 2020, name: 'Euro 2020' },
  { league: 4, season: 2024, name: 'Euro 2024' },
  // Eliminatórias — América do Sul
  { league: 34, season: 2018, name: 'WC Qual SA 2018' },
  { league: 34, season: 2022, name: 'WC Qual SA 2022' },
  { league: 34, season: 2026, name: 'WC Qual SA 2026' },
  // Eliminatórias — Europa
  { league: 32, season: 2018, name: 'WC Qual Europe 2018' },
  { league: 32, season: 2020, name: 'WC Qual Europe 2020' },
  { league: 32, season: 2024, name: 'WC Qual Europe 2024' },
];

async function run() {
  const logger = new Logger('Backfill');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  const sync = app.get(SyncFootballDataUseCase);

  for (const t of TARGETS) {
    try {
      const r = await sync.execute({
        competitionExternalRef: String(t.league),
        season: String(t.season),
      });
      logger.log(`[OK] ${t.name}: ${JSON.stringify(r)}`);
    } catch (err: any) {
      logger.error(`[FALHOU] ${t.name}: ${err?.message ?? err}`);
    }
  }

  await app.close();
  logger.log('Backfill concluído.');
}

void run();
