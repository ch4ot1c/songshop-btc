const { Blockchain, Product, User, Transaction } = require('./models')

async function getProducts () {
  return Product.find({}).exec()
}

async function getProductById (id) {
  return Product.findById(id).exec()
}

async function getProductByIndex (i) {
  return Product.findOne({i: i}).exec()
}

// (Autoincrements `i`)
async function createNextProduct (product) {
  return new Product(product).save()
}

async function createProducts (products) {
  let psCreations = []
  for (const p of products) {
    psCreations.push(new Product(p).save())
  }
  const createdAll = await Promise.all(psCreations)
  console.log(createdAll)
}

async function getUserByAddress (address) {
  return User.findOne({address_btc: address}).exec()
}

async function createUser (user) {
  return new User(user).save()
}

async function createTransaction (transaction) {
  console.log(transaction)
  return new Transaction(transaction).save()
}

async function getTransactions () {
  return Transaction.find({}).exec()
}

async function getTransactionByTxid (txid) {
  return Transaction.findOne({txid: txid}).exec()
}

async function updateTransactionByTxid (txid, update) {
  return Transaction.findOneAndUpdate({txid: txid}, update).exec()
}

async function markTransactionVended (txid) {
  return Transaction.findOneAndUpdate({txid: txid}, {isVended: true}).exec()
}

async function getLatestTip () {
  return Blockchain.findOne().exec()
}

async function updateLatestTip (height) {
  return Blockchain.findOneAndUpdate({}, {latest_tip_height: height}).exec()
}

async function initDB (products, height = 0) {
  const chain = await getLatestTip()
  if (chain) {
    // Already initialized
    return
  }
  return Promise.all([createProducts(products), new Blockchain({latest_tip_height: height}).save()])
}

module.exports = {
  getProducts,
  getProductById,
  getProductByIndex,
  createNextProduct,
  createProducts,

  getUserByAddress,
  createUser,

  createTransaction,
  getTransactions,
  getTransactionByTxid,
  updateTransactionByTxid,
  markTransactionVended,

  getLatestTip,
  updateLatestTip,

  initDB
}
