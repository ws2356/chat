import express from 'express'
import { verify, signin, signup, signupVerify, autoSignup, getAccessToken } from './ctrls/auth'
import { get } from 'lodash'

const router = express.Router()
router.get('/verify', verify)
router.post('/login', signin)
router.post('/signin', signin)
router.post('/signup/complete', signup)
router.post('/signup/verify-email', signupVerify)
router.post('/signup/auto', autoSignup)
router.post('/wechat/access_token', getAccessToken)

export = router
