import express from 'express'
import _ from 'lodash'
import crypto from 'crypto'
import { createClient } from 'redis'
import { getChatMessageRepo } from '../../db'
import { ChatReply } from '../../entity/chat_reply'

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
    await redisClient.set(chatMessageKey, JSON.stringify(data))
  } catch (error) {
    console.error('setGptRequestCache', error)
  }
}

export function isCarMove(text: string) {
  return text.includes('挪车') ||
    text.includes('拖车') ||
    text.includes('挪一下') ||
    text.includes('动一下') ||
    text.includes('你的车') ||
    text.includes('你车')
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