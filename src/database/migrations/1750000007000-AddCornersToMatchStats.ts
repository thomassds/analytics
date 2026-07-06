import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** Escanteios por time por partida — vêm do mesmo /fixtures/statistics. */
export class AddCornersToMatchStats1750000007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'match_stats',
      new TableColumn({
        name: 'corner_kicks',
        type: 'int',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('match_stats', 'corner_kicks');
  }
}
