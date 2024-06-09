import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";

export default class Contract {
  constructor(network, callback) {
    let config = Config[network];
    this.web3 = new Web3(
      new Web3.providers.WebsocketProvider(config.url.replace("http", "ws"))
    );
    this.flightSuretyApp = new this.web3.eth.Contract(
      FlightSuretyApp.abi,
      config.appAddress
    );
    this.initialize(callback);
    this.owner = null;
    this.airlines = [];
    this.passengers = [];
  }

  initialize(callback) {
    this.web3.eth.getAccounts((error, accts) => {
      this.owner = accts[0];

      let counter = 1;

      while (this.airlines.length < 5) {
        this.airlines.push(accts[counter++]);
      }

      while (this.passengers.length < 5) {
        this.passengers.push(accts[counter++]);
      }

      callback();
    });
  }

  // Get active account
  async getActiveAccount(callback) {
    // Get active account in first time
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    callback(null, accounts[0]);

    // Listen for account change when switch on metamask
    window.ethereum.on("accountsChanged", function (accounts) {
      callback(null, accounts[0]);
    });
  }

  isOperational(callback) {
    let self = this;
    self.flightSuretyApp.methods
      .isOperational()
      .call({ from: self.owner }, callback);
  }

  getAccountStatus(from, callback) {
    let self = this;

    self.flightSuretyApp.methods
      .getAccountStatus()
      .call({ from: from }, (error, result) => {
        callback(error, result);
      });
  }

  getListRegisteredAirlines(from, callback) {
    let self = this;

    self.flightSuretyApp.methods
      .getListRegisteredAirlines()
      .call({ from: from }, (error, result) => {
        callback(error, result);
      });
  }

  isFundableAirline(from, callback) {
    let self = this;

    self.flightSuretyApp.methods
      .isFundableAirline()
      .call({ from: from }, (error, result) => {
        callback(error, result);
      });
  }

  fundAirline(from, callback) {
    let self = this;

    console.log("this.web3.utils.toWei", this.web3.utils.toWei("10", "ether"));

    self.flightSuretyApp.methods.fund(from).send(
      {
        from: from,
        value: this.web3.utils.toWei("10", "ether"),
        gas: 6721975,
      },
      (error, result) => {
        callback(error, result);
      }
    );
  }

  setOperatingStatus(status, callback) {
    let self = this;
    self.flightSuretyApp.methods
      .setOperatingStatus(status)
      .send({ from: self.owner }, (error, result) => {
        callback(error, result);
      });
  }

  getBalance(callback) {
    let self = this;
    self.flightSuretyApp.methods.getBalance().call((error, result) => {
      callback(error, result);
    });
  }

  getInsuranceAmount(from, callback) {
    let self = this;

    self.flightSuretyApp.methods
      .getPayment()
      .call({ from: from }, (error, result) => {
        callback(error, result);
      });
  }

  withdraw(from, callback) {
    let self = this;

    self.flightSuretyApp.methods
      .withdraw()
      .call({ from: from }, (error, result) => {
        console.log("withdraw", error);
        callback(error, result);
      });
  }

  // Register Airline
  async registerAirline(address, name, from, callback) {
    let self = this;

    try {
      const txHash = await self.flightSuretyApp.methods
        .registerAirline(address, name)
        .send({ from: from, gas: 6721975 });

      callback(null, txHash);
    } catch (e) {
      callback(e, null);
    }
  }

  async voteAirline(address, from, callback) {
    let self = this;

    try {
      const txHash = await self.flightSuretyApp.methods
        .voteAirline(address)
        .send({ from: from, gas: 6721975 });

      callback(null, txHash);
    } catch (e) {
      callback(e, null);
    }
  }

  async registerFlight(flightCode, departure, airline, callback) {
    let self = this;

    try {
      const txHash = await self.flightSuretyApp.methods
        .registerFlight(flightCode, departure, airline)
        .send({ from: airline, gas: 6721975 });

      callback(null, txHash);
    } catch (e) {
      callback(e, null);
    }
  }

  getFlights(from, callback) {
    let self = this;

    self.flightSuretyApp.methods
      .getFlights()
      .call({ from: from }, (error, result) => {
        callback(error, result);
      });
  }

  buyInsurance(flight, amount, from, callback) {
    let self = this;

    self.flightSuretyApp.methods.buyInsurance(flight).send(
      {
        from: from,
        value: this.web3.utils.toWei(amount, "ether"),
        gas: 6721975,
      },
      (error, result) => {
        callback(error, result);
      }
    );
  }

  getFlightStatus(from, flightCode, airlineAddress, callback) {
    let self = this;
    let payload = {
      airline: airlineAddress,
      flight: flightCode,
      timestamp: Math.floor(Date.now() / 1000),
    };
    self.flightSuretyApp.methods
      .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
      .send({ from: from }, (error, result) => {
        callback(error, result);
      });
  }
}
