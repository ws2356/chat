import { MigrationInterface, QueryRunner } from "typeorm"

// TODO: remove reply_id column from chat_message table later
export class ChangeChatMessageChatReplyOneToMany1686323301070 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            queryRunner.query(`
            ALTER TABLE chat_reply ADD COLUMN chat_message_id integer NOT NULL default 0;
            `)
            queryRunner.query(`
            UPDATE chat_reply
            SET chat_message_id = chat_message.id
            FROM chat_message
            WHERE chat_message.reply_id = chat_reply.id;
            `)
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`ChangeChatMessageChatReplyOneToMany1686323301070 failed: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            queryRunner.query(`
            ALTER TABLE chat_reply DROP COLUMN chat_message_id;
            `)
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`ChangeChatMessageChatReplyOneToMany1686323301070 failed: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

}
