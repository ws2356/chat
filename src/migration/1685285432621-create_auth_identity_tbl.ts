import {MigrationInterface, QueryRunner, Table } from "typeorm";

export class createAuthIdentityTbl1685285432621 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.createTable(new Table({
            name: 'auth_identity',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                },
                {
                    name: 'username',
                    type: 'varchar',
                    isNullable: true,
                },
                {
                    name: 'gender',
                    type: 'int',
                    isNullable: true,
                },
                {
                    name: 'marital_status',
                    type: 'int',
                    isNullable: true,
                },
                {
                    name: 'birthday',
                    type: 'date',
                    isNullable: true,
                },
                {
                    name: 'created_at',
                    type: 'timestamp',
                    isNullable: false,
                },
                {
                    name: 'updated_at',
                    type: 'timestamp',
                    isNullable: false,
                },
            ],
        }),
            true)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('auth_identity')
    }

}
