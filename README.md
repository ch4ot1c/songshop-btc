# songshop-btc 

Accept Bitcoin payments and vend files - without requiring users to log in.

- Polls `bitcoind` using RPC for payments to a set of addresses
- Runs an Express HTTP and WebSocket API to communicate with browsers
- Uses MongoDB and Mongoose for persistence
- Uses JWTs to generate temporary, unique download links
- Uses SendGrid to deliver emails

## Instructions

- `npm i`
- Rename `config/default.sample.json` to `default.json` and adjust
- Put `.flac` files to vend into `songs/`, named by `product.i`

- Run `mongod` 
- Run `bitcoind` 
- Run: `node index.js`

## License

- See `LICENSE` for information

## TODO

- See `TODO`s in files
