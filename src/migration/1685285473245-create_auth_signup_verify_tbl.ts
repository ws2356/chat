import {MigrationInterface, QueryRunner, Table, TableIndex} from "typeorm";

export class createAuthSignupVerify1685285473245 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.createTable(new Table({
                name: 'auth_signup_verify',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                    },
                    {
                        name: 'auth_id',
                        type: 'varchar',
                        length: '128',
                        isNullable: false,
                    },
                    {
                        name: 'auth_type',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'auth_status',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'code',
                        type: 'varchar',
                        length: '6',
                        isNullable: false,
                    },
                    {
                        name: 'device_id',
                        type: 'varchar',
                        length: '64',
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
                ]
            }), true)
            await queryRunner.createIndex('auth_signup_verify', new TableIndex({
                name: 'idx_auth_signup_verify_auth_id_type',
                columnNames: ['auth_id', 'auth_type'],
                isUnique: true,
            }))
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`failed to drop auth_signup table: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.dropIndex('auth_signup_verify', 'idx_auth_signup_verify_auth_id_type')
            await queryRunner.dropTable('auth_signup_verify')
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`failed to drop auth_signup_verify table: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

}
