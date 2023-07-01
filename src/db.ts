import * as fs from 'fs'
import * as path from 'path'
import { Repository, DataSource, EntityManager } from 'typeorm'
import { ChatMessage } from './entity/chat_message'
import { ChatReply } from './entity/chat_reply'
import { ChatSubscription } from './entity/chat_subscription'
import { ChatThread } from './entity/chat_thread'

const ormconfigPath = path.resolve(__dirname, '../ormconfig.json')
const dbConfig = JSON.parse(fs.readFileSync(ormconfigPath).toString())

export const dataSource = new DataSource({
  ...dbConfig,
    entities: [ChatMessage, ChatReply, ChatSubscription],
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

export function getChatSubscriptionRepo(entityManager?: EntityManager): Repository<ChatSubscription> {
  return (entityManager || getManager()).getRepository(ChatSubscription)
}

export function getChatThreadRepo(entityManager?: EntityManager): Repository<ChatThread> {
  return (entityManager || getManager()).getRepository(ChatThread)
}