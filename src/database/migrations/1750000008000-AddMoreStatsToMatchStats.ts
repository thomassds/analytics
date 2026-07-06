import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** Mais estatísticas por time (faltas, impedimentos, defesas) do /fixtures/statistics. */
export class AddMoreStatsToMatchStats1750000008000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('match_stats', [
      new TableColumn({ name: 'fouls', type: 'int', isNullable: true }),
      new TableColumn({ name: 'offsides', type: 'int', isNullable: true }),
      new TableColumn({
        name: 'goalkeeper_saves',
        type: 'int',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('match_stats', [
      'fouls',
      'offsides',
      'goalkeeper_saves',
    ]);
  }
}
