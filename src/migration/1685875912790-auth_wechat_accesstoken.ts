import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm"

export class AuthWechatAccesstoken1685875912790 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.createTable(new Table({
                name: 'auth_wechat_accesstoken',
                columns: [
                    { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
                    { name: 'client_id', type: 'varchar', length: '64', isNullable: false },
                    { name: 'token', type: 'varchar', length: '512', isNullable: false },
                    { name: 'expires_at', type: 'timestamp', isNullable: false },
                    { name: 'created_at', type: 'timestamp', isNullable: false },
                    { name: 'updated_at', type: 'timestamp', isNullable: false },
                ]
            }), true)
            await queryRunner.createIndex('auth_wechat_accesstoken', new TableIndex({
                name: 'idx_auth_wechat_accesstoken_client_id',
                columnNames: ['client_id'],
                isUnique: true,
            }))
            await queryRunner.commitTransaction()
        } catch (err) {
            console.error(`failed to start transaction: ${err}`)
            await queryRunner.rollbackTransaction()
            return
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            await queryRunner.dropIndex('auth_wechat_accesstoken', 'idx_auth_wechat_accesstoken_client_id')
            await queryRunner.dropTable('auth_wechat_accesstoken')
            await queryRunner.commitTransaction()
        } catch (err) {
            console.error(`failed to start transaction: ${err}`)
            await queryRunner.rollbackTransaction()
        }
    }

}
