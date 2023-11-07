require('dotenv').config()
process.env["NODE_CONFIG_DIR"] = __dirname + "/../config/"
import "reflect-metadata"
import express from 'express'
import * as fs from 'fs'
import * as util from 'util'
import cookieParser from 'cookie-parser'
import ejs from 'ejs'
import { urlencoded, json } from 'body-parser'
import _, { random } from 'lodash'
import cors from 'cors'
import * as qs from 'qs'
import xmlParser from 'express-xml-bodyparser'
import router from './router'
import { initDb } from './db'
import { getMessageById } from './ctrls/helper/chat_helper'
import { triggerAsyncId } from "async_hooks"

const readFileAsync = util.promisify(fs.readFile);

console.error('process.env.NODE_ENV: ', process.env.NODE_ENV);

(async function main() {

  try {
    await initDb()
  } catch (e) {
    console.error(`initDb failed: ${e}`)
    process.exit(1)
  }

  const app = express()
  app.set('trust proxy', true)
  app.use(cookieParser())
  app.use(json())
  app.use(xmlParser())
  app.use(urlencoded({ extended: true, limit: 1000 }))
  app.use(cors({
    origin: /(\/\/|\.)wansong\.vip(\/|$)|^http:\/\/localhost:803[0-9]/,
  }))
  app.use(express.static('public'))

  app.get('/message/:id', async (req, res) => {
    const { id } = req.params as { id: string }
    const idNum = parseInt(id, 10)
    if (isNaN(idNum)) {
      res.status(400).send('invalid id')
      return
    }
    // res.type('text/html').status(200).send(MessagePageHtml)
    res.status(302).redirect(`/fe/index.html?id=${id}`)
  })

  app.use((req, res, next) => {
    const reqId = Math.random().toString(36).substr(2, 8)
    res.locals.reqId = reqId
    const startAt = new Date()
    console.log(`[${reqId}] [${startAt.toISOString()}] ${req.method} ${req.host} ${req.url}`)
    next()
  })

  app.get('/302setcookie', (req, res) => {
    fs.readFile('templates/302setcookie.html', (err, data) => {
      if (err) {
        res.status(500).send('io')
      } else {
        res.type('text/html')
        res.send(data)
      }
    })
  })

  app.use('/', router)

  const port = 8030
  app.listen(port, () => {
    console.log(`server started on port: ${port}`)
  })

})()
