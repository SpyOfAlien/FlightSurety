import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";

let config = Config["localhost"];
let web3 = new Web3(
  new Web3.providers.WebsocketProvider(config.url.replace("http", "ws"))
);
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(
  FlightSuretyApp.abi,
  config.appAddress
);

const oracleIndexes = [];

flightSuretyApp.events.OracleRequest(
  {
    fromBlock: "latest",
  },
  function (error, event) {
    if (error) console.log(error);
    let index = event.returnValues.index;
    oracleIndexes.forEach((oracle) => {
      if (oracle.indexes.includes(index)) {
        let statusCode = Math.floor(Math.random() * 6) * 10;
        flightSuretyApp.methods
          .submitOracleResponse(
            index,
            event.returnValues.airline,
            event.returnValues.flight,
            event.returnValues.timestamp,
            statusCode
          )
          .send({
            from: oracle.address,
            gas: 6721975,
          })
          .then((_) => {
            console.log(
              "Oracle response sent",
              oracle.address,
              index,
              statusCode
            );
          })
          .catch((error) => {
            console.log(
              "Oracle response error",
              oracle.address,
              index,
              statusCode,
              error
            );
          });
      }
    });
  }
);

const app = express();
app.get("/api", (req, res) => {
  res.send({
    message: "An API for use with your Dapp!",
  });
});

function getOracleAccounts() {
  return new Promise((resolve, reject) => {
    web3.eth.getAccounts((error, accts) => {
      if (error) {
        reject(error);
      }

      // Get 25 account at index 30, 30 first account for airline and passengers
      console.log(accts.slice(30, 55));
      resolve(accts.slice(30, 55));
    });
  });
}

function initOracles() {
  getOracleAccounts()
    .then((oracleAccounts) => {
      oracleAccounts.forEach((account) => {
        console.log("account", account);
        flightSuretyApp.methods
          .registerOracle()
          .send({
            from: account,
            value: web3.utils.toWei("1", "ether"),
            gas: 6721975,
          })
          .then((_) => {
            flightSuretyApp.methods
              .getMyIndexes()
              .call({
                from: account,
              })
              .then((indexes) => {
                console.log("oracle account indexes", indexes);
                oracleIndexes.push({
                  address: account,
                  indexes: indexes,
                });
              })
              .catch((error) => {
                console.log(error);
              });
          })
          .catch((error) => {
            console.log(error);
          });
      });
    })
    .catch((error) => {
      console.log(error);
    });
}

initOracles();

export default app;
