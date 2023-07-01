import { MigrationInterface, QueryRunner } from "typeorm"
import { getChatMessageRepo, getChatThreadRepo } from '../db'
import { ChatThread } from "../entity/chat_thread"

export class CreateChatThreadForExistingMessages1688230373623 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.startTransaction()
            const chatMessageRepo = getChatMessageRepo(queryRunner.manager)
            const chatThreadRepo = getChatThreadRepo(queryRunner.manager)
            const messages = await chatMessageRepo.find()
            const now = new Date()
            const chatThreads = messages.map(msg => {
                return { authId: msg.authId, authType: msg.authType, toUserName: msg.toUserName, completed: true, createdAt: now, updatedAt: now }
            })
            const newChatThreads = await chatThreadRepo.save(chatThreads)
            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i]
                const thread = newChatThreads[i]
                msg.chatThread = thread
                await chatMessageRepo.save(msg)
            }
            await queryRunner.commitTransaction()
        } catch (error) {
            console.error(`CreateChatThreadForExistingMessages1688230373623 failed: ${error}`)
            await queryRunner.rollbackTransaction()
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('CreateChatThreadForExistingMessages1688230373623 down noop')
    }
}
