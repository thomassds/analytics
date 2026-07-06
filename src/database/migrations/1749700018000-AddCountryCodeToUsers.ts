import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCountryCodeToUsers1749700018000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'country_code',
        type: 'varchar',
        length: '10',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'country_code');
  }
}
