const HDWalletProvider = require("@truffle/hdwallet-provider");
var mnemonic =
  "maximum dirt panda area wide toast marble music oven office result case";

module.exports = {
  networks: {
    development: {
      provider: function () {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
      },
      network_id: "*",
      gas: 6721975,
    },
  },
  compilers: {
    solc: {
      version: "^0.4.25",
    },
  },
};
