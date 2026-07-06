import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PollLiveMatchUseCase } from './poll-live-match.use-case';

/**
 * Poller ao vivo: SEMPRE ativo. A cada minuto descobre pelo horário quais jogos
 * deveriam estar rolando agora e os atualiza. Custo zero de cota quando não há
 * jogo no ar (só faz chamada à API quando há candidato). Kill-switch opcional:
 * LIVE_POLLING_ENABLED=false desliga.
 *
 * Candidatos = já ao vivo (status 1) OU agendados cujo horário já começou
 * (kickoff no passado, dentro de ~4h — cobre 90'+acréscimos+prorrogação e
 * recuperação se o backend ficou fora do ar). Assim que a API devolve FT, o
 * jogo vira finalizado e sai da lista sozinho.
 */
@Injectable()
export class LiveCron {
  private readonly logger = new Logger(LiveCron.name);

  constructor(
    private readonly config: ConfigService,
    private readonly poll: PollLiveMatchUseCase,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  /** Ligado por padrão; desliga via .env com LIVE_POLLING_ENABLED=false (0/off/no). */
  private get disabled(): boolean {
    const v = (this.config.get<string>('LIVE_POLLING_ENABLED') ?? '')
      .trim()
      .toLowerCase();
    return v === 'false' || v === '0' || v === 'off' || v === 'no';
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'live-poller' })
  async tick(): Promise<void> {
    if (this.disabled) return;

    const rows: Array<{ id: string }> = await this.ds.query(
      `SELECT id FROM matches
       WHERE status = 1
          OR (status = 0
              AND kickoff_at <= now()
              AND kickoff_at > now() - interval '4 hours')
       ORDER BY kickoff_at ASC
       LIMIT 40`,
    );
    if (rows.length === 0) return; // nenhum jogo rolando → 0 chamada à API

    this.logger.log(`Ao vivo: atualizando ${rows.length} jogo(s)…`);
    for (const r of rows) {
      try {
        await this.poll.execute(r.id);
      } catch (e: any) {
        this.logger.error(`poll ${r.id} falhou: ${e?.message ?? e}`);
      }
    }
  }
}
