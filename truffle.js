const {
  name: packageName,
  version,
  description,
  keywords,
  license,
  author,
  contributors
} = require('./package.json')

const DEFAULT = {
  host: 'localhost',
  port: 8545,
  network_id: '*', // Match any network id
  gas: 4600000
}

module.exports = {
  packageName,
  version,
  description,
  keywords,
  license,
  authors: [author, ...contributors],
  networks: {
    geth: { ...DEFAULT, gas: 999999 },
    live: {
      network_id: 1,
      host: "localhost",
      port: 8545,
      gas: 4400000,
      gasPrice: 21000000000
    },
    ropsten: {
      network_id: 3,
      host: "localhost",
      port: 8545,
      gas: 4400000,
      gasPrice: 21000000000
    },
    private: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gas: 4400000,
      gasPrice: 21000000000
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
}
