import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAddressToUsers1749600005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'zip_code',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
      new TableColumn({
        name: 'street',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'neighborhood',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'city',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
      new TableColumn({
        name: 'state',
        type: 'varchar',
        length: '2',
        isNullable: true,
      }),
      new TableColumn({
        name: 'number',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
      new TableColumn({
        name: 'complement',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('users', [
      'zip_code',
      'street',
      'neighborhood',
      'city',
      'state',
      'number',
      'complement',
    ]);
  }
}
