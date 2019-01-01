const config = require('config')
const email = require('./email')
const db = require('./db/controllers')

const stdrpc = require('stdrpc')

// Bitcoin RPC Interface - regtest: 18443, testnet: 18332, mainnet: 8332
// Note: Set rpcuser="u" and rpcpassword="REPLACE_ME" in ~/.bitcoin/bitcoin.conf
// Note: `bitcoind -debug` to test
// TODO cookie rpcauth
const rpcUrl = 'http://' + config.get('btc.rpc_user') + ':' + config.get('btc.rpc_password') + '@localhost:' + config.get('btc.rpc_port')
const rpc = stdrpc({ url: rpcUrl })
// Note: Keep RPC ports behind your firewall! The only time you should even consider exposing them is
// if you have built with `./configure --disable-wallet` and/or are running with `bitcoind -disablewallet`.

const { asyncPoll } = require('async-poll')
const pollRate = config.get('server.rpc_poll_rate_seconds') * 1000 // ms

const DESIRED_CONFIRMATIONS = 6

// TODO default this to blockchain tip at setup (in db)
const CONSIDER_FROM_HEIGHT = 649 // 0

// const RPC_MAX_TIP = 1e6 - 1 // block 999,999

// const FORGIVENESS_SATS = 0

// TODO can add firstSeenAtBlock to Users, so that no frontrunning of donations
// is possible

// TODO interactive setup process for products
const ORDERED_PRODUCTS = [
  { address_btc: 'mmu27g7CvUFmb3ToSRaVjw9P5iLao58Ggq', price_sats_btc: 1000 },
  { address_btc: 'mwGMvg3fqnHrXc2P94eLYUw7iyMNk3MmSt', price_sats_btc: 2000 }
] // (Demo)
// P2PKH BTC mainnet addresses start with a `1`

// State
let products = []

function beginPolling () {
  db.initDB(ORDERED_PRODUCTS).then(result => {
    db.getProducts().then(ps => {
      products = ps

      const shouldStop = () => false
      asyncPoll({fn: reconsiderPTxs, conditionFn: shouldStop, interval: pollRate, timeout: Number.MAX_SAFE_INTEGER})
        .then(console.log)
        .catch(console.error)
    }).catch(console.error)
  }).catch(console.error)
}

// TODO error handling for awaits
async function reconsiderPTxs () {
  console.info('\nPolling...\n')

  const height = await rpc.getblockcount()
  const sinceLastBlock = await rpc.listsinceblock('', height, true, true) // All

  let latestTipHeight = (await db.getLatestTip()).latest_tip_height

  if (height !== latestTipHeight) {
    console.info(`NEW Tip: ${height}! Previous: ${latestTipHeight}`)
    latestTipHeight = height
    await db.updateLatestTip(latestTipHeight)
  }

  // console.info(`Total txs: ${sinceLastBlock.transactions.length}`)
  // console.info(`'Receive' txs: ${sinceLastBlock.transactions.filter(t => t.category === 'receive').length}`)

  for (const tx of sinceLastBlock.transactions) {
    if (tx.category !== 'receive') continue

    if (tx.confirmations >= DESIRED_CONFIRMATIONS) {
      if (latestTipHeight - tx.confirmations >= CONSIDER_FROM_HEIGHT) {
        let seenTx = await db.getTransactionByTxid(tx.txid)
        if (!seenTx) {
          const newConfdTx = {txid: tx.txid, amount_received_sats: btcToSats(tx.amount), block_mined_height: height - tx.confirmations, isVended: false}
          seenTx = await db.createTransaction(newConfdTx)
          // console.info(seenTx)
        }
        if (!seenTx.isVended) {
          // Ensure tx is paid to a product addr
          const p = products.find(p => p.address_btc === tx.address)
          if (!p) continue

          const txInfo = await rpc.gettransaction(tx.txid, true)
          const payers = txInfo.details.filter(d => d.category === 'send').map(d => d.address)
          console.log(payers)
          const dbUsersLookup = []
          for (const p of payers) {
            dbUsersLookup.push(db.getUserByAddress(p))
          }
          const us = await Promise.all(dbUsersLookup)
          if (us.length > 0) { // Vend to all
            for (const u of us) {
              if (!u) continue
              await vend(tx, p, u)
              await db.markTransactionVended(tx.txid)
            }
          } else {
            console.info('Payment from unknown payer(s), nothing vended.')
          }
        } else { console.info('Already vended...') }
      } else { console.info('Ancient tx, skipping (1).') }
    } else if (tx.confirmations >= 1 || tx.confirmations < DESIRED_CONFIRMATIONS) {
      if (latestTipHeight - tx.confirmations >= CONSIDER_FROM_HEIGHT) {
        let seenTx = db.getTransactionByTxid(tx.txid)
        if (!seenTx) {
          const newMinedTx = {txid: tx.txid, amount_received_sats: btcToSats(tx.amount), block_mined_height: height - tx.confirmations, isVended: false}
          seenTx = await db.createTransaction(newMinedTx)
        } else {
          console.info(`Confirming tx: ${tx.txid}... confs: ${tx.confirmations}`)
        }
      } else { console.info('Ancient tx, skipping (2).') }
    } else { // Unconfirmed (Mempool)
      const newUnconfdTx = {txid: tx.txid, amount_received_sats: btcToSats(tx.amount), isVended: false}
      await db.createTransaction(newUnconfdTx)
    }
  }

  // console.log(await db.getTransactions())
  console.log('\n')
  // console.clear()
}

// Vend a product, by default via email
// Uses a JWT in a URL to limit access
async function vend (paymentTx, product, user) {
  console.log(`Vending #${product.i} to ${user.email}:\n${JSON.stringify(paymentTx)}`)
  const sentRes = await email.sendEmail(user.email, product, paymentTx.txid)
  if (!sentRes) return // comment out for mock
  console.log(`Vended #${product._id}:\n${JSON.stringify(sentRes[0].statusCode)})`)
  // console.log(`Email response #${product.i}:\n ${JSON.stringify(sentRes)}`) // mock
  // TODO socket.io vend (to `u` only)
}

function btcToSats (amountBTC) {
  return Math.round(amountBTC * 10e8)
}

module.exports = { beginPolling }
