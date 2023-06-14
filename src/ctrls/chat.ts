import express from 'express'
import { Readable } from 'stream'
import axios from 'axios'
import _ from 'lodash'
import * as xml2js from 'xml2js'
import { getChatMessageRepo, dataSource, getChatReplyRepo, getChatSubscriptionRepo } from '../db'
import { ChatMessage } from '../entity/chat_message'
import { getGptRequestCache, setGptRequestCache, waitMs, isCarMove, verifyWechatSignature } from './helper/auth_helper'
import { AUTH_TYPE_MLGB, GPT_API_URL, GPT_REQUEST_TEMPLATE, GPT_SYSTEM_ROLE_INFO } from '../constants'
import { ChatReply } from '../entity/chat_reply'


type SupportedMsgType = 'text' | 'voice' | 'event' | 'link'

interface WechatBaseEvent {
  ToUserName: string,
  FromUserName: string,
  CreateTime: string,
  MsgType:SupportedMsgType,
}

interface WechatMessageEvent {
  ToUserName: string,
  FromUserName: string,
  CreateTime: string,
  MsgType: SupportedMsgType,
  Content: string,
  MsgId: string,
  Recognition?: string,
}

interface WechatSubscriptionEvent {
  ToUserName: string,
  FromUserName: string,
  CreateTime: string,
  MsgType: 'event',
  Event: string, // 'subscribe' | 'unsubscribe',
}

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

export async function healthCheck(req: express.Request, res: express.Response) {
  res.type('application/xml')
  try {
    await sendResult(res, 200, 'success')
    console.log('healthCheck ok')
  } catch (error) {
    console.error(`healthCheck error: ${error}`)
  }
}

async function sendReply(res: express.Response, wechatEvent: WechatBaseEvent, replyContent: string): Promise<boolean> {
  const replyMessage = {
    ToUserName: wechatEvent.FromUserName,
    FromUserName: wechatEvent.ToUserName,
    CreateTime: Math.floor(Date.now() / 1000),
    MsgType: 'text', // wechatEvent.MsgType, currently only support replying with text
    Content: replyContent,
  }
  const replyXml = new xml2js.Builder().buildObject({ xml: replyMessage })
  try {
    await sendResult(res, 200, replyXml)
    return true
  } catch (error) {
    console.error(`[${res.locals.reqId}] sendReply fail: ${error}`)
    return false
  }
}

async function sendTestLinkReply(res: express.Response, wechatEvent: WechatBaseEvent, replyContent: string): Promise<boolean> {
  const replyMessage = {
    ToUserName: wechatEvent.FromUserName,
    FromUserName: wechatEvent.ToUserName,
    CreateTime: Math.floor(Date.now() / 1000),
    MsgType: wechatEvent.MsgType, // currently only support replying with text
    Title: 'test link',
    Description: 'test link',
    Url: replyContent,
  }
  const replyXml = new xml2js.Builder().buildObject({ xml: replyMessage })
  try {
    await sendResult(res, 200, replyXml)
    return true
  } catch (error) {
    console.error(`[${res.locals.reqId}] sendReply fail: ${error}`)
    return false
  }
}

function isReplyValid(reply: ChatReply): boolean {
  return reply.loadStatus === 1 && !_.isEmpty(reply.reply)
}

async function markReplyAsReplied(id: number, reply: Partial<ChatReply>) {
  try {
    await getChatReplyRepo().update(id, { ...reply, replied: true })
  } catch (error) {
    console.error(`markReplyAsReplied error: ${error}`)
  }
}

type GetOrCreateChatMessageResult =
  { chatMessage: ChatMessage | null, validReply?: ChatReply, newReply?: ChatReply }

export async function handleWechatSubscription(req: express.Request, res: express.Response, subscribeEvent: WechatSubscriptionEvent) {
  const { ToUserName, FromUserName, CreateTime, MsgType, Event } = subscribeEvent
  if (MsgType !== 'event' ||
    typeof ToUserName !== 'string' ||
    typeof FromUserName !== 'string' ||
    typeof CreateTime !== 'string' ||
    (Event !== 'subscribe' && Event !== 'unsubscribe')) {
    console.error(`bad arg: ${JSON.stringify(subscribeEvent, null, 4)}`)
    res.status(400).send('bad arg')
    return
  }
  
  if (Event === 'subscribe') {
    const welcomeMessage = '欢迎关注！如果需要联系挪车，直接回复消息：“挪车”。'
    await sendReply(res, subscribeEvent, welcomeMessage)
  } else {
    const welcomeMessage = '你知道吗，本公众号是一个高级人工智能机器人，你可以直接和它聊天（不要提到挪车。。），它会自动回复你的。'
    await sendReply(res, subscribeEvent, welcomeMessage)
  }

  try {
    await getChatSubscriptionRepo().save({
      authId: FromUserName,
      authType: AUTH_TYPE_MLGB,
      toUserName: ToUserName,
      createTime: new Date(parseInt(CreateTime) * 1000),
      event: Event,
    })
  } catch (error) {
    console.error(`save subscribe event error: ${error}`)
  }
}

export async function handleWechatEvent(req: express.Request, res: express.Response) {
  if (!verifyWechatSignature(req, res)) {
    console.error(`[${res.locals.reqId}] bad sig: ${JSON.stringify(req.query, null, 4)}`)
    res.status(400).send('bad signature')
    return
  }

  res.type('application/xml')

  const data: any = req.body || {}
  const {
    tousername: ToUserName,
    fromusername: FromUserName,
    createtime: CreateTime,
    msgtype: MsgType,
    content: TextContent,
    msgid: MsgId,
    mediaid: MediaId,
    format: Format,
    event: Event,
    recognition: Recognition,
    url: Url } = _.mapValues(data.xml, (v: any) => v && v[0])

  if (MsgType === 'event') {
    await handleWechatSubscription(
      req,
      res,
      { ToUserName, FromUserName, CreateTime, MsgType: 'event', Event })
    return
  }

  if (typeof MsgId !== 'string' ||
    (MsgType !== 'text' && MsgType !== 'voice' && MsgType !== 'link') ||
    (Format === 'text' && typeof TextContent !== 'string') ||
    typeof ToUserName !== 'string' ||
    typeof FromUserName !== 'string' ||
    typeof CreateTime !== 'string' ||
    (Format === 'voice' && typeof MediaId !== 'string') ||
    (Format === 'voice' && typeof Format !== 'string') ||
    (Format === 'voice' && !Recognition)) {
    console.error(`bad arg: ${JSON.stringify(data, null, 4)}`)
    res.status(400).send('bad arg')
    return
  }

  if (['text', 'voice', 'link'].indexOf(MsgType) === -1) {
    await sendReply(res, { ToUserName, FromUserName, CreateTime, MsgType }, '暂不支持此消息类型')
    return
  }

  const Content = MsgType === 'voice' ? Recognition : ( MsgType === 'text' ? TextContent : Url)

  if (Content.startsWith('https://')) {
    await sendTestLinkReply(res, { ToUserName, FromUserName, CreateTime, MsgType: 'link' }, Content)
    return
  }

  if (!Content) {
    console.error(`empty content: ${JSON.stringify(data, null, 4)}`)
    res.status(400).send('empty content')
    return
  }

  // no throw
  const pendingGetOrCreateChatMessage = dataSource.transaction(async (manager) => {
    try {
      const chatMessage = await getChatMessageRepo(manager).findOne({
        where: {
          authType: AUTH_TYPE_MLGB,
          authId: FromUserName,
          msgId: MsgId,
          msgType: MsgType,
        }
      })
      if (chatMessage) {
        return chatMessage
      }

      const now = new Date()
      const ret = await getChatMessageRepo(manager).save({
        authType: AUTH_TYPE_MLGB,
        authId: FromUserName,
        msgId: MsgId,
        msgType: MsgType,
        content: Content,
        toUserName: ToUserName,
        createTime: new Date(parseInt(CreateTime) * 1000),
        mediaId: MediaId || null,
        format: Format || null,
      })
      const reply = await getChatReplyRepo(manager).save({
        loadStatus: 4,
        createdAt: now,
        chatMessage: ret,
      })
      ret.replies = [reply]
      return ret
    } catch (error) {
      console.error(`[${res.locals.reqId}] find or create fail: ${error}`)
      // Assuming duplicate key error
      return null
    }
  })
  .then((chatMessage: ChatMessage | null): GetOrCreateChatMessageResult => {
    if (!chatMessage) {
      return { chatMessage: null }
    }

    const validReply = chatMessage.replies.find((reply) => isReplyValid(reply))
    const newReply = chatMessage.replies.find((reply) => reply.loadStatus === 4)
    return { chatMessage, validReply, newReply }
  })
  .then(async ({ chatMessage, validReply, newReply }): Promise<GetOrCreateChatMessageResult> => {
    if (newReply) {
      newReply.loadStatus = 2
      try {
        await getChatReplyRepo().update(newReply.id, newReply)
      } catch (error) {
        console.error(`[${res.locals.reqId}] markReplyPending error: ${error}`)
      }
    }
    return { chatMessage, validReply, newReply }
  })

  // no throw
  const pendingDetermineReplyContent = (async (): Promise<[any, string, boolean]> => {
    if (isCarMove(Content)) {
      const carMoveReply = `车主已经收到您的消息。即将为您挪车。紧急情况请拨打：${process.env.MY_PHONE_NUMBER}。`
      return [null, carMoveReply, false]
    }

    const chatMessageKey = `${AUTH_TYPE_MLGB}-${FromUserName}-${MsgId}-${MsgType}`
    const cachedRequest = await getGptRequestCache(chatMessageKey)
    if (cachedRequest) {
      if (cachedRequest.completed) {
        return [null, cachedRequest.result, false]
      } else {
        return [null, '', true]
      }
    }
    await setGptRequestCache(chatMessageKey, { completed: false, result: '' })

    const gptRequestBody = {
      ...GPT_REQUEST_TEMPLATE,
      messages: [
        GPT_SYSTEM_ROLE_INFO,
        { role: 'user', content: Content }
      ]
    }

    let replyContent = ''

    try {
      const timerLabel = `[${res.locals.reqId}] start request gpt`
      console.time(timerLabel)
      console.log(timerLabel)
      const gptResp = await axios.post(
        GPT_API_URL,
        gptRequestBody,
        {
          headers: {
            'api-key': `${process.env.GPT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        })
      console.timeEnd(timerLabel)

      const gptRespData = gptResp.data
      const { content } = _.get(gptRespData, ['choices', 0, 'message'], {})
      replyContent = content || ''

      if (gptResp.status !== 200 || !replyContent) {
        console.error(`[${res.locals.reqId}] gpt api return invalid data: ${gptResp.status}, ${JSON.stringify(gptResp.data, null, 4)}`)
        return [null, '', false]
      }
      return [null, replyContent, false]
    } catch (error: any) {
      console.error(`[${res.locals.reqId}] gpt api error: ${error}`)
      return [error, '', false]
    } finally {
      await setGptRequestCache(chatMessageKey, { completed: true, result: replyContent })
    }
  })();

  const [{ chatMessage, validReply, newReply }, [requestError, replyContent, isReusingRequest]] = await Promise.all([pendingGetOrCreateChatMessage, pendingDetermineReplyContent])

  if (!chatMessage) {
    console.error(`[${res.locals.reqId}] server error: chatMessage not found`)
    res.status(500).send('server error')
    return
  }

  const content = validReply ? validReply.reply! : replyContent
  if (content) {
    const replied = await sendReply(
      res,
      {
        ToUserName,
        FromUserName,
        CreateTime,
        MsgType,
      },
      content
    )
    if (!isReusingRequest && replyContent && newReply) {
      newReply.reply = replyContent
      newReply.loadStatus = 1
      try {
        const data: Partial<ChatReply> = {
          reply: replyContent,
          loadStatus: 1,
          loadedAt: new Date(),
        }
        if (replied) {
          data.replied = true
        }
        await markReplyAsReplied(newReply.id, data)
      } catch (error) {
        console.error(`[${res.locals.reqId}] markReplySuccess error: ${error}`)
      }
    } else if (validReply && replied) {
      await markReplyAsReplied(validReply.id, { replied })
    }
  } else if (isReusingRequest) {
    // polls
    let validReply: ChatReply | undefined
    for (let i = 0; i < 5; ++i) {
      await waitMs(1000)
      const newChatMessage = await getChatMessageRepo().findOne({
        where: { id: chatMessage.id },
      })
      if (!newChatMessage) {
        continue
      }
      validReply = newChatMessage.replies.find((reply) => isReplyValid(reply))
      if (validReply) {
        break
      }
    }

    if (!validReply) {
      console.error(`failed to poll reply: ${res.locals.reqId}`)
      res.status(500).send(`failed to poll reply: ${res.locals.reqId}`)
    } else {
      const replied = await sendReply(
        res,
        {
          ToUserName,
          FromUserName,
          CreateTime,
          MsgType,
        },
        validReply.reply!
      )
      if (replied) {
        await markReplyAsReplied(validReply.id, { replied: true })
      }
    }
  } else {
    console.error(`[${res.locals.reqId}] first run gpt request failed`)
    res.status(500).send(`server fail: ${res.locals.reqId}`)
  }

  if (newReply && !isReusingRequest && requestError) {
    newReply.loadStatus = 3
    await getChatReplyRepo().update({ id: newReply.id }, { loadStatus: 3 })
  }
}


export async function getMessageById(req: express.Request, res: express.Response) {
  const { id } = req.params as { id: string }
  const idNum = parseInt(id, 10)
  if (isNaN(idNum)) {
    res.status(400).send('invalid id')
    return
  }
  const chatMessage = await getChatMessageRepo().findOne({ where: { id: idNum } })
  if (!chatMessage) {
    res.status(404).send('not found')
    return
  }
  res.type('application/json')
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
  res.send(JSON.stringify(data))
}