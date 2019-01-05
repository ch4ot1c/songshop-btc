// HTTP + Socket.io (Express) API
// Serves api routes, including product file links
const config = require('config')

const express = require('express')
const bodyParser = require('body-parser')
const morgan = require('morgan')

const path = require('path')
const jwt = require('jsonwebtoken')

const mongoose = require('mongoose')

// const https = require('https')
const http = require('http')
const SocketIOServer = require('socket.io')

const rateLimit = require('express-rate-limit')

const db = require('./db/controllers')
const poller = require('./poller')
const validation = require('./validation')

// Connections
let httpServer
let io

// Per-IP Rate Limiting
function configureRateLimiter () {
  const dlLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 15
  })

  const postLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10
  })

  const getLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100
  })

  // app.enable('trust proxy') // only if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)

  app.use('/s/', dlLimiter)

  const postRoutes = ['/guestbook']
  for (const r of postRoutes) {
    app.use(r, postLimiter)
  }

  const getRoutes = ['../client/'] // TODO does trailing slash include index.html?
  for (const r of getRoutes) {
    app.use(r, getLimiter)
  }
}

const app = express()
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(morgan('tiny')) // 'combined'

// Catch-all error handler
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }
  res.status(500)
  res.render('error', { error: err })
}
app.use(errorHandler)

app.use(express.static('../client'))

configureRateLimiter()

// Serve homepage
app.get('/', (req, res) => {
  res.sendFile(path.resolve('../client/index.html'))
})

// Input: { userAddress: '123ABCabc', userEmail: 'me@example.com' }
// Output: { users: [...] }
app.post('/guestbook', (req, res) => {
  const user = { address_btc: req.body.userAddress, email: req.body.userEmail }

  if (validation.isValidEmail(user.email)) {
    const e = Error('Email Address failed regex validation')
    return res.status(400).send({ error: e.message })
  }
  if (validation.isValidAddressBTC(user.address_btc)) {
    const e = Error('BTC Address failed base58check validation')
    return res.status(400).send({ error: e.message })
  }

  db.getUserByAddress(user.address_btc).then(prior => {
    if (!prior) {
      db.createUser(user).then(u => {
        res.sendStatus(201)
      })
    } else if (prior.email === user.email && prior.address_btc === user.address_btc) {
      return res.send({ message: 'Welcome Back' })
    } else {
      // TODO check whether nonzero payment history
      const e = Error('This address has already been claimed: ' + JSON.stringify(prior))
      res.status(400).send({ error: e.message })
    }
  })

  // Notes:
  // address / email update protocol options:
  // - TODO - set a password for this email...?
  // - 'An email is already registered for this input address. You must message the administrator with a proof of ownership to get it reset.'
})

// Output: { products: [...] }
app.get('/products', (req, res) => {
  db.getProducts().then(ps => {
    res.send({products: ps})
  })
})

// Input: URL .../s/1?jwt=x
// Output
app.get('/s/:productIndex', (req, res) => {
  const token = req.query.jwt || req.body.jwt
  const pIndex = req.params.productIndex

  db.getProductByIndex(pIndex).then(p => {
    if (!p) {
      const e = Error('Unknown product: ' + pIndex)
      return res.status(404).send({ error: e.message })
    }

    if (!token) {
      return res.status(400).send({ error: 'Missing jwt in query params' })
    }

    try {
      const decoded = jwt.verify(token, config.get('server.jwt_secret') + 'x' + p.i)
      console.log('Successfully decoded jwt: ', decoded)
    } catch (e) {
      return res.status(400).send({ error: e.message })
    }

    // TODO filetype
    const outputFilename = (p.name || p.i) + '.flac'
    // Vend file!
    res.download(path.join(config.get('server.products_dir'), p.i + '.flac'), outputFilename)
  })
})

// Kickoff
function start () {
  mongoose.connect(config.get('server.mongo_cxn_url')).then(ret => {
    httpServer = http.Server(app)
    io = SocketIOServer(httpServer)

    const port = config.get('server.http_ws_port')
    httpServer.listen(port, s => {
      console.log(`Express HTTP listening on port ${port}!`)
      // Begin polling bitcoind's RPC interface for updates
      poller.beginPolling()
    }) // TODO - HTTPS

    io.on('connection', s => {
      console.log(`Socket.IO WS connected on same port as HTTP.`)
    })
  }).catch(e => console.error(e))
}

module.exports = { start }
