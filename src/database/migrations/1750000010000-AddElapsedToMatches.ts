import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** Minuto atual do jogo (só faz sentido durante o ao vivo). */
export class AddElapsedToMatches1750000010000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'matches',
      new TableColumn({ name: 'elapsed', type: 'int', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('matches', 'elapsed');
  }
}
