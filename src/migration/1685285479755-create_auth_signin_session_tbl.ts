import {MigrationInterface, QueryRunner, Table, TableIndex} from "typeorm";

export class createAuthSigninSession1685285479755 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.createTable(new Table({
                name: 'auth_signin_session',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                    },
                    {
                        name: 'signup_id',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'token',
                        type: 'varchar',
                        length: '64',
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
                ]
            }), true)
            await queryRunner.createIndex('auth_signin_session', new TableIndex({
                name: 'idx_auth_signin_session_token',
                columnNames: ['token'],
                isUnique: true,
                }))
            await queryRunner.commitTransaction()
        } catch (error) {
            await queryRunner.rollbackTransaction()
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.dropIndex('auth_signin_session', 'idx_auth_signin_session_token')
            await queryRunner.dropTable('auth_signin_session')
            await queryRunner.commitTransaction()
        } catch (error) {
            await queryRunner.rollbackTransaction()
        }
    }

}
