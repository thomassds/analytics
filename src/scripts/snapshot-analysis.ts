import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { SnapshotAnalysisUseCase } from '../modules/football/analytics/snapshot-analysis.use-case';

/**
 * Congela a análise pré-jogo dos jogos AGENDADOS (status 0). Ideal rodar perto
 * do apito (cron). Uso: yarn snapshot:analysis
 */
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const ds = app.get(DataSource);
    const rows: Array<{ id: string }> = await ds.query(
      `SELECT id FROM matches WHERE status = 0 ORDER BY kickoff_at ASC`,
    );
    const snap = app.get(SnapshotAnalysisUseCase);
    console.log(`Congelando ${rows.length} jogos agendados…`);
    let ok = 0;
    for (const r of rows) {
      try {
        await snap.execute(r.id);
        ok++;
      } catch (e: any) {
        console.error(`  falha em ${r.id}: ${e?.message ?? e}`);
      }
    }
    console.log(`Snapshots gravados: ${ok}/${rows.length}`);
  } catch (err: any) {
    console.error('Falha:', err?.message ?? err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
