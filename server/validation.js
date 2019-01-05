const config = require('config')
const { address, networks } = require('bitcoinjs-lib')

function isValidAddressBTC (addr) {
   const { version, _ } = address.fromBase58Check(addr)
   return version === networks[config.get('btc.network')].pubKeyHash
}

function isValidEmail (emailAddr) {
   return (/^[a-zA-Z0-9.!#$%&*+=?^_{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/).test(emailAddr) 
}

module.exports = { isValidAddressBTC, isValidEmail }
