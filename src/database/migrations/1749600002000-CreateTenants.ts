import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateTenants1749600002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tenants',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'tax_identifier', type: 'varchar', length: '20' },
          { name: 'email', type: 'varchar', length: '255' },
          { name: 'country_code', type: 'varchar', length: '10' },
          { name: 'phone', type: 'varchar', length: '20' },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
          { name: 'deleted_at', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tenants');
  }
}
