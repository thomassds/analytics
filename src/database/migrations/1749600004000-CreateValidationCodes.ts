import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateValidationCodes1749600004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'validation_codes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'user_id', type: 'uuid' },
          { name: 'code', type: 'varchar', length: '6' },
          {
            name: 'type',
            type: 'varchar',
            length: '20',
            comment: 'email | phone',
          },
          { name: 'attempts', type: 'int', default: 0 },
          { name: 'used', type: 'boolean', default: false },
          { name: 'expires_at', type: 'timestamp' },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'validation_codes',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('validation_codes');
  }
}
