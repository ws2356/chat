import express from 'express'
import { Readable } from 'stream'
import { InsertResult } from "typeorm"
import { v4 as uuidv4 } from 'uuid'
import { parse as parseTld } from 'tldts'
import axios from 'axios'
import config from 'config'
import md5 from 'md5'
import _ from 'lodash'
import * as xml2js from 'xml2js'
import { getChatMessageRepo, dataSource, getChatReplyRepo } from '../db'
import { ChatMessage } from '../entity/chat_message'
import { waitMs } from './helper/auth_helper'
import { AUTH_STATUS_OK, AUTH_STATUS_PENDING, AUTH_TYPE_EMAIL, MLGB_ACCESS_TOKEN_RESERVE_FRESH_MS, MLGB_CLIENT_ID, AUTH_TYPE_MLGB, GPT_API_URL, GPT_REQUEST_TEMPLATE, GPT_SYSTEM_ROLE_INFO } from '../constants'
import { send } from 'process'

const urlRegex = /https?:\/\//i

const tokenName = 'token-of-auth'

const authSessionTtl = config.get('authSessionTtl') as number

async function sendResult(res: express.Response, status: number, result: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const readable = Readable.from(result)
    readable.on('error', (error) => {
      console.error(`sendResult error: ${error}`)
      res.end()
      reject(error)
    })
    readable.on('end', () => {
      resolve()
    })
    readable.pipe(res.status(status))
  })
}
const UNEXPECTED_ERROR = new Error('insert fail unexpected')
export async function handleWechatEvent(req: express.Request, res: express.Response) {
  res.type('application/xml')

  const data: any = req.body || {}
  console.log(`body: ${JSON.stringify(data, null, 4)}`)
  const { ToUserName, FromUserName, CreateTime, MsgType, Content, MsgId } = data.xml

  if (typeof MsgId !== 'string' ||
    typeof MsgType !== 'string' ||
    typeof Content !== 'string' ||
    typeof ToUserName !== 'string' ||
    typeof FromUserName !== 'string' ||
    typeof CreateTime !== 'string') {
    console.error(`bad arg: ${JSON.stringify(data, null, 4)}`)
    res.status(400).send('bad arg')
    return
  }

  if (!Content) {
    res.status(200).send('success')
    return
  }

  const [chatMessage, isCreated] = await dataSource.transaction(async (manager) => {
    const now = new Date()
    try {
      const insertRes = await getChatMessageRepo(manager).insert({
        authType: AUTH_TYPE_MLGB,
        authId: FromUserName,
        msgId: MsgId,
        msgType: MsgType,
        content: Content,
        toUserName: ToUserName,
        createTime: new Date(parseInt(CreateTime) * 1000),
        reply: {
          loadStatus: 2,
          createdAt: now,
          updatedAt: now,
        }
      })
      if (insertRes.identifiers.length !== 1) {
        // TODO: remove debug code - should not throw error here
        throw UNEXPECTED_ERROR
      }
      return getChatMessageRepo(manager).findOne({
        where: {
          authType: AUTH_TYPE_MLGB,
          authId: FromUserName,
          msgId: MsgId,
        },
      })
      .then((chatMessage: ChatMessage | null) => [chatMessage, true])
    } catch (error) {
      // TODO: remove debug code
      if (error === UNEXPECTED_ERROR) {
        console.error(`unexpected error: ${error}`)
        res.status(500).send('server fail')
        throw error
      }
      if (!chatMessage) {
        console.error(`assumption of duplicate key error not correct: ${error}`)
        res.status(500).send(`assumption of duplicate key error not correct: ${error}`)
        throw error
      }
      // Assuming duplicate key error
      return getChatMessageRepo(manager).findOne({
        where: { msgId: MsgId },
      })
      .then((chatMessage: ChatMessage | null) => [chatMessage, false])
    }
  })

  if (!chatMessage) {
    console.error('chatMessage not found or created')
    res.status(500).send('server fail')
    return
  }

  // TODO: handle retry
  let replyContent = ''
  if (chatMessage.reply.loadStatus === 3 || isCreated) {
    const gptRequestBody = {
      ...GPT_REQUEST_TEMPLATE,
      messages: [
        GPT_SYSTEM_ROLE_INFO,
        { role: 'user', content: Content }
      ]
    }
    try {
      const gptResp = await axios.post(
        GPT_API_URL,
        gptRequestBody,
        {
          headers: {
            'api-key': `${process.env.GPT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        })
      if (gptResp.status !== 200) {
        console.error(`gpt api fail: ${gptResp.status}, ${JSON.stringify(gptResp.data, null, 4)}`)
        res.status(500).send('server fail')
        return
      }
      const gptRespData = gptResp.data
      const { content } = _.get(gptRespData, ['choices', 0, 'message'], {})
      replyContent = content || ''
      await getChatReplyRepo().update({ reply: content || '', loadStatus: 1 }, { id: chatMessage.reply.id })
    } catch (error) {
      console.error(`db query fail: ${error}`)
      res.status(500).send('server fail')
      await getChatReplyRepo().update({ loadStatus: 3 }, { id: chatMessage.reply.id })
      return
    }
  } else {
    // polls reply
    for (let i = 0; i < 5; ++i) {
      await waitMs(1000)
      const chatReply = await getChatReplyRepo().findOne({ where: { id: chatMessage.reply.id } })
      if (chatReply?.loadStatus === 1) {
        replyContent = chatReply.reply || ''
        break
      }
    }

    if (!replyContent) {
      console.error('replyContent not found')
      res.status(500).send('server fail')
      return
    }
  }

  const replyMessage = {
    ToUserName: FromUserName,
    FromUserName: ToUserName,
    CreateTime: Math.floor(Date.now() / 1000),
    MsgType: 'text',
    Content: replyContent,
  }
  const replyXml = new xml2js.Builder().buildObject({ xml: replyMessage })

  try {
    await sendResult(res, 200, replyXml)
    console.log(`reply success: ${replyXml}}`)
  } catch (error) {
    // no need to call res.send again, because sendResult already call res.send on success and res.end on error
    console.error(`sendResult fail: ${error}`)
  }

  try {
    await getChatReplyRepo().update({ replied: true }, { id: chatMessage.reply.id })
  } catch (error) {
    console.error(`update replied = true fail: ${error}`)
  }
}
