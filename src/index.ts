require('dotenv').config()
process.env["NODE_CONFIG_DIR"] = __dirname + "/../config/"
import "reflect-metadata"
import express from 'express'
import * as fs from 'fs'
import * as util from 'util'
import cookieParser from 'cookie-parser'
import ejs from 'ejs'
import { urlencoded, json } from 'body-parser'
import _ from 'lodash'
import cors from 'cors'
import * as qs from 'qs'
import xmlParser from 'express-xml-bodyparser'
import router from './router'
import { initDb } from './db'

const readFileAsync = util.promisify(fs.readFile);

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

  app.get('/echo', async (req, res) => {
    type Item = { name: string, value: any }

    const { headers, cookies } = req

    const cookieList: Item[] = !cookies
      ? []
      : Object.keys(cookies).map(name => ({ name, value: cookies[name] }))
    const headerList: Item[] = !headers
      ? []
      : Object.keys(headers)
      .filter(name => name.toLowerCase() !== 'cookie')
      .map(name => ({ name, value: headers[name] }))

    ejs.renderFile('templates/page.ejs',
      { title: 'echo', cookies: cookieList, headers: headerList },
      (err, result) => {
        if (err) {
          res.status(500).send(`ejs render failed: ${err}`)
        } else {
          res.type('text/html')
          res.send(result)
        }
      })
  })

  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.host} ${req.url}`)
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
