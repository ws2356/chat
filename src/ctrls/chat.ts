import express from 'express'
import { Readable } from 'stream'
import axios from 'axios'
import _ from 'lodash'
import * as xml2js from 'xml2js'
import { getChatMessageRepo, dataSource, getChatReplyRepo, getChatSubscriptionRepo, getChatThreadRepo } from '../db'
import { ChatMessage } from '../entity/chat_message'
import { getGptRequestCache, setGptRequestCache, waitMs, verifyWechatSignature, isReplyValid, getMessageOptions, formatChatThread } from './helper/chat_helper'
import { AUTH_TYPE_MLGB, GPT_API_URL, GPT_REQUEST_TEMPLATE, GPT_SYSTEM_ROLE_INFO } from '../constants'
import { ChatReply } from '../entity/chat_reply'
import { ChatThread } from '../entity/chat_thread'
import { getMessageById } from './helper/chat_helper'


const MAX_TOKENS = GPT_REQUEST_TEMPLATE["max_tokens"] as number

type SupportedMsgType = 'text' | 'voice' | 'event'

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
  res.type('text/plain')
  try {
    await sendResult(res, 200, 'success')
    console.log('healthCheck ok')
  } catch (error) {
    console.error(`healthCheck error: ${error}`)
  }
}

async function sendXmlReply(res: express.Response, wechatEvent: WechatBaseEvent, replyContent: string): Promise<boolean> {
  const replyMessage = {
    ToUserName: wechatEvent.FromUserName,
    FromUserName: wechatEvent.ToUserName,
    CreateTime: Math.floor(Date.now() / 1000),
    MsgType: 'text', // wechatEvent.MsgType, currently only support replying with text
    Content: replyContent,
  }
  const replyXml = new xml2js.Builder().buildObject({ xml: replyMessage })
  try {
    res.type('application/xml')
    console.log(`[${res.locals.reqId}] [${new Date().toISOString()}] sendReply start`)
    await sendResult(res, 200, replyXml)
    console.log(`[${res.locals.reqId}] [${new Date().toISOString()}] sendReply finish`)
    return true
  } catch (error) {
    console.error(`[${res.locals.reqId}] [${new Date().toISOString()}] sendReply fail: ${error}`)
    return false
  }
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
    res.type('text/plain')
    res.status(400).send('bad arg')
    return
  }
  
  if (Event === 'subscribe') {
    const welcomeMessage = `欢迎关注我的公众号！如果需要联系本人，请拨打电话：${process.env.MY_PHONE_NUMBER}`
    await sendXmlReply(res, subscribeEvent, welcomeMessage)
  } else {
    const welcomeMessage = '你知道吗，本公众号是一个高级人工智能机器人，你可以直接和它聊天，它会自动回复你的。'
    await sendXmlReply(res, subscribeEvent, welcomeMessage)
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
    recognition: Recognition } = _.mapValues(data.xml, (v: any) => v && v[0])

  if (MsgType === 'event') {
    await handleWechatSubscription(
      req,
      res,
      { ToUserName, FromUserName, CreateTime, MsgType: 'event', Event })
    return
  }

  if (typeof MsgId !== 'string' ||
    (MsgType !== 'text' && MsgType !== 'voice') ||
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

  if (['text', 'voice'].indexOf(MsgType) === -1) {
    await sendXmlReply(res, { ToUserName, FromUserName, CreateTime, MsgType }, '暂不支持此消息类型')
    return
  }

  const rawContent = MsgType === 'voice' ? Recognition : TextContent

  if (!rawContent) {
    console.error(`empty content: ${JSON.stringify(data, null, 4)}`)
    res.status(400).send('empty content')
    return
  }

  const messageOptions = getMessageOptions(rawContent)
  const Content = rawContent.substring(messageOptions.optionLength)
  if (!Content) {
    res.status(200).send('success')
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
        },
      })
      if (chatMessage) {
        return chatMessage
      }

      let latestThread: ChatThread | null = null
      if (!messageOptions.newThread) {
        latestThread = await getChatThreadRepo(manager).findOne({
          where: {
            authType: AUTH_TYPE_MLGB,
            authId: FromUserName,
          },
          order: { createdAt: 'DESC' },
        })
        if (latestThread && latestThread.completed) {
          latestThread = null
        }
      } else {
        const lastThreadToFinish = await getChatThreadRepo(manager).findOne({
          where: {
            authType: AUTH_TYPE_MLGB,
            authId: FromUserName,
          },
          order: { createdAt: 'DESC' },
        })

        if (lastThreadToFinish && !lastThreadToFinish.completed) {
          lastThreadToFinish.completed = true
          lastThreadToFinish.updatedAt = new Date()
          await getChatThreadRepo(manager).save(lastThreadToFinish)
        }
      }
      if (!latestThread) {
        const now = new Date()
        latestThread = await getChatThreadRepo(manager).save({
          authType: AUTH_TYPE_MLGB,
          authId: FromUserName,
          toUserName: ToUserName,
          completed: false,
          createdAt: now,
          updatedAt: now,
        })
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
        chatThread: latestThread,
        tries: 1,
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
        await getChatReplyRepo().update(newReply.id, { loadStatus: 2})
      } catch (error) {
        console.error(`[${res.locals.reqId}] markReplyPending error: ${error}`)
      }
    } else if (chatMessage) {
      chatMessage.tries += 1
      try {
        await getChatMessageRepo().update(chatMessage.id, { tries: chatMessage.tries })
      } catch (error) {
        console.error(`[${res.locals.reqId}] updateTries error: ${error}`)
      }
    }
    if (chatMessage) {
      const thread = chatMessage.chatThread
      if (thread) {
        // MAX_TOKENS is a very conserverative limit so we won't missing any message falsely
        thread.messages = await getChatMessageRepo().find({
          where: { chatThread: thread },
          order: { createTime: 'DESC' },
          take: MAX_TOKENS,
        })
      }
    }
    return { chatMessage, validReply, newReply }
  })

  const { chatMessage, validReply, newReply } = await pendingGetOrCreateChatMessage

  if (!chatMessage) {
    console.error(`[${res.locals.reqId}] server error: chatMessage not found`)
    res.status(500).send('server error')
    return
  }

  // if newReply: need call GPT
  // else poll

  // no throw
  const pendingDetermineReplyContent = async (): Promise<string> => {
    // if (cachedRequest) {
    //   cachedRequest.tries += 1
    //   await setGptRequestCache(chatMessageKey, { ...cachedRequest })
    //   return [null, cachedRequest]
    // } else {
    //   await setGptRequestCache(chatMessageKey, { completed: false, result: '', tries: 1 })
    // }

    const gptRequestBody = {
      ...GPT_REQUEST_TEMPLATE,
      messages: formatChatThread(chatMessage!.chatThread),
    }
    if (messageOptions.deterministic) {
      gptRequestBody.temperature = 0
    }

    const getReply = async (): Promise<string> => {
      try {
        const now = new Date()
        console.log(`[${res.locals.reqId}] gpt req starts`)
        console.log(`[${res.locals.reqId}] req: ${JSON.stringify(gptRequestBody, null, 4)}`)
        const gptResp = await axios.post(
          GPT_API_URL,
          gptRequestBody,
          {
            headers: {
              'api-key': `${process.env.GPT_API_KEY}`,
              'Content-Type': 'application/json'
            }
          })
        const gptRespData = gptResp.data
        console.log(`[${res.locals.reqId}] [${new Date().toISOString()}] gpt req completes with res: ${JSON.stringify(gptRespData, null, 4)}`)

        const { content } = _.get(gptRespData, ['choices', 0, 'message'], {})
        const replyContent = content || ''
        if (gptResp.status !== 200 || !replyContent) {
          console.error(`[${res.locals.reqId}] [${new Date().toISOString()}] gpt api return invalid data: ${gptResp.status}, ${JSON.stringify(gptResp.data, null, 4)}`)
          return ''
        }
        return replyContent
      } catch (error: any) {
        console.error(`[${res.locals.reqId}] gpt api error: ${error}`)
        throw error
      }
    }

    let countdown = 3
    while (countdown-- > 0) {
      try {
        const replyContent = await getReply()
        return replyContent
      } catch (error: any) {
        if (error.code !== 'EAI_AGAIN' || countdown <= 0) {
          if (newReply) {
            newReply.loadStatus = 3
            await getChatReplyRepo().update({ id: newReply.id }, { loadStatus: 3 })
          }
          console.error(`[${res.locals.reqId}] gpt api error: ${error}`)
          return ''
        }
        const randomDelay = Math.floor(Math.random() * 1000) + 500
        console.warn(`[${res.locals.reqId}] gpt api error: ${error}, would retry in ${randomDelay}ms`)
        await waitMs(randomDelay)
      }
    }
    return ''
  };

  const tries = chatMessage.tries
  const replyContent = tries === 1 ? (await pendingDetermineReplyContent()) : ''
  const content = validReply ? validReply.reply! : replyContent

  if (content) {
    const replied = await sendXmlReply(
      res,
      {
        ToUserName,
        FromUserName,
        CreateTime,
        MsgType,
      },
      content
    )
    if (newReply) {
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
        console.log(`[${res.locals.reqId}] [${new Date().toISOString()}] markReplySuccess success`)
      } catch (error) {
        console.error(`[${res.locals.reqId}] [${new Date().toISOString()}] markReplySuccess error: ${error}`)
      }
    } else if (validReply && replied) {
      await markReplyAsReplied(validReply.id, { replied })
    }
  } else if (!newReply) {
    // polls
    let validReply: ChatReply | undefined
    // if last try, poll 2 times otherwise 4 times
    const pollTime = tries === 3 ? 2 : 4
    for (let i = 0; i < pollTime; ++i) {
      await waitMs(1000)
      const newChatMessage = await getChatMessageRepo().findOne({
        where: { id: chatMessage.id },
      })
      console.log(`[${res.locals.reqId}] [${new Date().toISOString()}] check chatMessage ${i}`)
      if (!newChatMessage) {
        continue
      }
      validReply = newChatMessage.replies.find((reply) => isReplyValid(reply))
      if (validReply) {
        break
      }
    }

    if (!validReply) {
      console.error(`[${res.locals.reqId}] [${new Date().toISOString()}] failed to poll reply ${tries}`)
      // res.status(500).send(`failed to poll reply: ${res.locals.reqId}`)
      // second try: no reply
      // third try: reply a web page for client to poll further
      if (tries === 3) {
        await sendXmlReply(
          res,
          {
            ToUserName,
            FromUserName,
            CreateTime,
            MsgType,
          },
          `点击<a href="https://${req.host}/message/${chatMessage.id}">链接</a>查看回复`
        )
      }
    } else {
      const replied = await sendXmlReply(
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
}

export async function getMessage(req: express.Request, res: express.Response) {
  const { id } = req.params as { id: string }
  const idNum = parseInt(id, 10)
  if (isNaN(idNum)) {
    res.status(400).send('invalid id')
    return
  }

  let data: { message: string, replies: string[] } | null = null
  try {
    data = await getMessageById(idNum)
    if (!data) {
      res.status(404).send('not found')
      return
    }
    const payload = { code: 0, data }
    res.type('application/json').send(JSON.stringify(payload))
  } catch (error) {
    console.error(`server failed: ${error}`)
    res.status(500).send(`server failed`)
    return
  }
}