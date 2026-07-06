import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PollLiveMatchUseCase } from '../modules/football/ingestion/poll-live-match.use-case';

/** Atualiza UM jogo ao vivo. Uso: yarn poll:live <matchId> */
async function run() {
  const matchId = process.argv[2];
  if (!matchId) {
    console.error('uso: yarn poll:live <matchId>');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const r = await app.get(PollLiveMatchUseCase).execute(matchId);
    console.log('resultado:', JSON.stringify(r));
  } catch (err: any) {
    console.error('Falha:', err?.message ?? err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
