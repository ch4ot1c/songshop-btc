const config = require('config')
const dl = require('./dl')
const sgMail = require('@sendgrid/mail')

sgMail.setApiKey(config.get('server.sendgrid_api_key'))

// Send email upon confirmed user payment to 'product'
// Can use JWTs to vend products this way; otherwise, donation receipt
async function sendEmail (destination, product, txID) {
  const msgText = `product #: ${product.i}, price (sats): ${product.price_sats_btc}, btc txid: ${txID}, dl link: ${dl.generateDownloadLink(product.i)}`
  const msgHTML = `<strong>${msgText}</strong>`
  // TODO - add explorer link (choose explorer via config)
  // TODO - tell them how much they paid vs price
  // TODO - add 'Problem?' text + link/email
  const msg = {
    to: destination,
    from: {
      name: 'Shop',
      email: `noreply@${config.get('server.hostname')}`
    },
    subject: `Your Delivery - Product #${product.i}`,
    text: msgText,
    html: msgHTML
  }

  return sgMail.send(msg)
  // return msg // mock
}

module.exports = { sendEmail }
