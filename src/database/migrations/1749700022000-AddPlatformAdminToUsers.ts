import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPlatformAdminToUsers1749700022000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'is_platform_admin',
        type: 'boolean',
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'is_platform_admin');
  }
}
