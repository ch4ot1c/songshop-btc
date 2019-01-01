const config = require('config')
const jwt = require('jsonwebtoken')

// Create a (unique) temporary link for a given product
function generateDownloadLink (pIndex) {
  const token = jwt.sign({ q: 'q' }, config.get('server.jwt_secret') + 'x' + pIndex, { expiresIn: config.get('server.jwt_timeout_seconds') })
  return config.get('server.hostname') + '/s/' + pIndex + '?jwt=' + token
}

module.exports = { generateDownloadLink }

