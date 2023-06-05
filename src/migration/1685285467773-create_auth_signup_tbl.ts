import {MigrationInterface, QueryRunner, Table, TableIndex} from "typeorm";

export class createAuthSignup1685285467773 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.createTable(new Table({
                name: 'auth_signup',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                    },
                    {
                        name: 'identity_id',
                        type: 'int',
                        isNullable: false,
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
                        name: 'credential',
                        type: 'varchar',
                        length: '128',
                        isNullable: false,
                    },
                    {
                        name: 'device_id',
                        type: 'varchar',
                        length: '64',
                        isNullable: true,
                    },
                    {
                        name: 'source',
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
            await queryRunner.createIndex('auth_signup', new TableIndex({
                name: 'auth_signup_auth_id_auth_type',
                columnNames: ['auth_id', 'auth_type'],
                isUnique: true,
            }))
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`failed to create auth_signup table: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.dropIndex('auth_signup', 'auth_signup_auth_id_auth_type')
            await queryRunner.dropTable('auth_signup')
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`failed to drop auth_signup table: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

}
