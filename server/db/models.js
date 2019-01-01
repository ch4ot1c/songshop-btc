// const config = require('config')

const mongoose = require('mongoose')
const { autoIncrement } = require('mongoose-plugin-autoinc')

const Schema = mongoose.Schema
// const ObjectId = mongoose.Schema.Types.ObjectId

// Upon restart, we scan forward from latest_tip_height
// This approach ensures that no payment txs to product addrs are missed
const BlockchainSchema = new Schema({
  latest_tip_height: {type: Number, required: true, default: 0}
  // latest_tip_hash: {type: String, required: true, default: config.get('btc.genesis_hash')}
}, {timestamps: true})
const Blockchain = mongoose.model('Blockchain', BlockchainSchema)

const ProductSchema = new Schema({
  i: {type: Number, index: true, required: true},
  price_sats_btc: {type: Number, required: true},
  address_btc: {type: String, required: true},
  name: {type: String, required: false}
}, {timestamps: true})
ProductSchema.plugin(autoIncrement, {field: 'i', startAt: 1, model: 'Product'})
const Product = mongoose.model('Product', ProductSchema)

const UserSchema = new Schema({
  address_btc: {type: String, required: true},
  email: {type: String, required: true}
}, {timestamps: true})
const User = mongoose.model('User', UserSchema)

// Created when first seen, if relevant to a product
// Updated once block_mined_height is known
const TransactionSchema = new Schema({
  block_mined_height: {type: Number, index: true, required: false},
  // block_mined_hash: {type: String, required: false},
  txid: {type: String, index: true, required: true},
  amount_received_sats: Number,
  isVended: {type: Boolean, required: true, default: false}
}, {timestamps: true})
const Transaction = mongoose.model('Transaction', TransactionSchema)

module.exports = {
  Blockchain,
  Product,
  User,
  Transaction
}
