import * as fs from 'fs'
import * as path from 'path'
import { Repository, DataSource, EntityManager } from 'typeorm'
import { ChatMessage } from './entity/chat_message'
import { ChatReply } from './entity/chat_reply'

const ormconfigPath = path.resolve(__dirname, '../ormconfig.json')
const dbConfig = JSON.parse(fs.readFileSync(ormconfigPath).toString())

export const dataSource = new DataSource({
  ...dbConfig,
    entities: [ChatMessage, ChatReply],
    loggerLevel: 'warn',
})

export async function initDb() {
  await dataSource.initialize()
}

function getManager() {
  return dataSource.manager
}

export function getChatMessageRepo(entityManager?: EntityManager): Repository<ChatMessage> {
  return (entityManager || getManager()).getRepository(ChatMessage)
}

export function getChatReplyRepo(entityManager?: EntityManager): Repository<ChatReply> {
  return (entityManager || getManager()).getRepository(ChatReply)
}