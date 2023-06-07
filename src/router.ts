import express from 'express'
import { handleWechatEvent } from './ctrls/chat'

const router = express.Router()
router.post('/', handleWechatEvent)

export = router
