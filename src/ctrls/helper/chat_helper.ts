import express from 'express'
import _ from 'lodash'
import crypto from 'crypto'
import { createClient } from 'redis'
import * as tiktoken from 'tiktoken'
import { getChatMessageRepo } from '../../db'
import { ChatReply } from '../../entity/chat_reply'
import { ChatMessage } from '../../entity/chat_message'
import { ChatThread } from '../../entity/chat_thread'
import { match } from 'assert'
import { GPT_SYSTEM_ROLE_INFO, GPT_REQUEST_TEMPLATE } from '../../constants'

export async function waitMs(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

if (!process.env.REDIS_URL) {
  console.error('missing REDIS_URL env')
  process.exit(1)
}
const redisClient = createClient({ url: process.env.REDIS_URL })
redisClient.on('error', err => console.log('Redis Client Error', err))
const pendingRedisConnect = redisClient.connect()


type GptRequestCache = {
  completed: boolean
  result: string
  tries: number
}

export async function getGptRequestCache(chatMessageKey: string): Promise<GptRequestCache | null> {
  try {
    await pendingRedisConnect
    const data = await redisClient.get(chatMessageKey)
    const ret = data ? JSON.parse(data) : null
    return ret
  } catch (error) {
    console.error('getGptRequestCache', error)
    return null
  }
}

export async function setGptRequestCache(chatMessageKey: string, data: GptRequestCache) {
  try {
    await pendingRedisConnect
    await redisClient.set(chatMessageKey, JSON.stringify(data), { EX: 15 })
  } catch (error) {
    console.error('setGptRequestCache', error)
  }
}

export type MessageOptions = {
  optionLength: number
  deterministic?: boolean
  newThread?: boolean
}

// TODO: auto wrap
const MessageOptionRegexp = /^([。.;])+[ ]*/

export function getMessageOptions(msg: string): MessageOptions {
  const options: MessageOptions = { optionLength: 0 }
  const match = msg.match(MessageOptionRegexp)
  if (!match) {
    return options
  }
  options.optionLength = match[0].length
  if (match[1]) {
    options.newThread = true
  }
  if (match[2]) {
    options.deterministic = true
  }
  return options
}

export function verifyWechatSignature(req: express.Request, res: express.Response): boolean {
  if (process.env.NODE_ENV === 'development' ||
    process.env.LOCAL_DEBUG === 'true') {
    return true
  }
  const { signature, timestamp, nonce } = req.query || {}
  if (typeof signature !== 'string' || typeof timestamp !== 'string' || typeof nonce !== 'string') {
    console.error(`[${res.locals.reqId}] invalid signature query`)
    return false
  }
  const token = process.env.WECHAT_SIGNATURE_TOKEN
  if (!token) {
    console.error(`[${res.locals.reqId}] WECHAT_SIGNATURE_TOKEN not set`)
    return false
  }
  const sha1hash = crypto.createHash('sha1');
  sha1hash.update([token, timestamp, nonce].sort().join(''));
  const signatureToVerify = sha1hash.digest('hex');
  const ret = signatureToVerify === signature
  if (!ret) {
    console.error(`[${res.locals.reqId}] invalid signature: ${signatureToVerify} !== ${signature}`)
  }
  return ret
}

export function isReplyValid(reply: ChatReply): boolean {
  return reply.loadStatus === 1 && !_.isEmpty(reply.reply)
}

export async function getMessageById(id: number): Promise<{ message: string, replies: string[] } | null> {
  const chatMessage = await getChatMessageRepo().findOne({ where: { id } })
  if (!chatMessage) {
    return null
  }
  chatMessage.replies.sort((a, b) => {
    const aLoaded = a.loadedAt ? a.loadedAt.getTime() : 0
    const bLoaded = b.loadedAt ? b.loadedAt.getTime() : 0
    return aLoaded - bLoaded
  })
  const validReplies = chatMessage.replies.filter((reply) => isReplyValid(reply))
  const data = {
    message: chatMessage.content,
    replies: validReplies.map((reply) => reply.reply),
  }
  return data as any
}

export type FormatedChatThreadItem = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const tokenEnc = tiktoken.encoding_for_model('gpt-3.5-turbo')
const MAX_TOKENS = GPT_REQUEST_TEMPLATE["max_tokens"] as number

export function formatChatThread(thread: ChatThread): FormatedChatThreadItem[] {
  const ret: FormatedChatThreadItem[] = [GPT_SYSTEM_ROLE_INFO as any]
  if (!thread.messages) {
    return ret
  }
  const messages = [...thread.messages]
  messages.sort((a, b) => {
    if (!a.createTime || !b.createTime) {
      return -1
    }
    return a.createTime.getTime() - b.createTime.getTime()
  })

  let tokenCount = tokenEnc.encode(JSON.stringify(ret[0])).length
  for (let i = messages.length - 1; i >= 0; --i) {
    const message = messages[i]
    const reply = message.replies.find((reply) => isReplyValid(reply))
    if (reply) {
      const tokens = tokenEnc.encode(JSON.stringify({ role: 'assistant', content: reply.reply! }))
      if (tokenCount + tokens.length > MAX_TOKENS) {
        console.warn(`skip oldest ${i} messages due to token limit: ${tokenCount} + ${tokens.length} > ${MAX_TOKENS}`)
        break
      }
      tokenCount += tokens.length
      ret.push({ role: 'assistant', content: reply.reply! })
    }
    const tokens = tokenEnc.encode(JSON.stringify({ role: 'user', content: message.content }))
    if (tokenCount + tokens.length > MAX_TOKENS) {
      console.warn(`skip oldest ${i} messages due to token limit: ${tokenCount} + ${tokens.length} > ${MAX_TOKENS}`)
      break
    }
    tokenCount += tokens.length
    ret.push({ role: 'user', content: message.content })
  }

  console.log(`prompt tokens: ${tokenCount}`)

  for (let i = 1; i < ret.length - i; ++i) {
    const j = ret.length - i
    const tmp = ret[i]
    ret[i] = ret[j]
    ret[j] = tmp
  }

  return ret
}