const HDWalletProvider = require("@truffle/hdwallet-provider");
var mnemonic =
  "reunion script obtain rebel combine motion series pistol pave race video mammal";

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
