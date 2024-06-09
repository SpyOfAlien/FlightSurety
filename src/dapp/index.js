import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";

const REVERT_ERROR = "VM Exception while processing transaction: revert";

(async () => {
  let activeAccount = null;
  let activeAccountRole = null;

  let contract = new Contract("localhost", async () => {
    initDatePicker();
    // Read transaction
    contract.isOperational((error, result) => {
      const opEl = DOM.elid("operational-status");
      opEl.textContent = result;
    });

    await contract.getActiveAccount((error, result) => {
      if (result !== activeAccount) {
        activeAccount = contract.web3.utils.toChecksumAddress(result);
        const accountEl = DOM.elid("active-account");
        accountEl.textContent = `${activeAccount.substring(
          0,
          6
        )}...${activeAccount.substring(activeAccount.length - 4)}`;

        contract.getBalance((error, balance) => {
          console.log(
            "Balance 1",
            contract.web3.utils.fromWei(balance, "ether")
          );
          console.log("error 1", error);
        });

        handleDisplayPayments(activeAccount, contract);
        handleDisplayMyAirline(activeAccount, contract);
        handleDisplayFlights(activeAccount, contract);

        // Check account status to display the right UI
        contract.getAccountStatus(activeAccount, (error, status) => {
          const isRegistered = status[0];
          const isFunded = status[1];

          DOM.showEleId("confirm-block", "block");
          DOM.showEleId("register-block", "flex");

          if (isRegistered) {
            if (isFunded) {
              activeAccountRole = "airline";
            } else {
              activeAccountRole = "guest-airline";
            }

            handleDisplayAirlines(activeAccount, contract, true);
          } else {
            activeAccountRole = "passenger";
            DOM.hideEleId("register-block");
            DOM.hideEleId("confirm-block");
          }
        });
      }
    });

    contract.flightSuretyApp.events.FlightStatusInfo(
      {
        fromBlock: "latest",
      },
      (err, res) => {
        if (err) showToast("error", err.message);
        const { flight, status } = res.returnValues;
        const flightEl = DOM.elid(flight);

        console.log("Flight status", status);

        if (flightEl) {
          const statusEl = document.createElement("div");
          statusEl.textContent = `Status: ${status}`;
          flightEl.appendChild(statusEl);
        }
      }
    );

    DOM.elid("active-account").addEventListener("click", () => {
      // Save to user clipboard
      navigator.clipboard.writeText(activeAccount);

      const accountEl = DOM.elid("active-account");
      if (accountEl) {
        showToast("success", "Copied to clipboard");
      }
    });

    DOM.elid("register-airline").addEventListener("click", async () => {
      const airlineAddress = DOM.elid("airline-address").value;
      const airlineName = DOM.elid("airline-name").value;

      // Check both fields are filled
      if (!airlineAddress || !airlineName) {
        showToast("error", "Please enter both the address and name");
        return;
      }

      // Check if the airline is currently loged in metamask
      if (airlineAddress === activeAccount) {
        showToast("error", "You cannot register yourself as an airline");
        return;
      }

      // Check if the address is valid
      if (contract.web3.utils.isAddress(airlineAddress) === false) {
        showToast("error", "Please enter a valid address");
        return;
      }

      await contract.registerAirline(
        airlineAddress,
        airlineName,
        activeAccount,
        (error, result) => {
          if (error) {
            handleError(error);
          } else if (result) {
            showToast("success", "Airline registered successfully");
            handleDisplayAirlines(activeAccount, contract);
          }
        }
      );
    });

    DOM.elid("register-flight").addEventListener("click", async () => {
      const flightCode = DOM.elid("flight-code").value;
      const departure = DOM.elid("departure").value;

      // Check both fields are filled
      if (!flightCode || !departure) {
        showToast("error", "Please enter all the fields");
        return;
      }

      const timestamp = new Date(departure).getTime();
      await contract.registerFlight(
        flightCode,
        timestamp,
        activeAccount,
        (error, result) => {
          if (error) {
            handleError(error);
          } else if (result) {
            showToast("success", "Flight registered successfully");
            handleDisplayFlights(activeAccount, contract);
          }
        }
      );
    });
  });
})();

function handleVote(airline, activeAccount, contract) {
  console.log("Voting for", airline);
  console.log("Active account", activeAccount);
  contract.voteAirline(airline, activeAccount, (error, result) => {
    if (error) {
      handleError(error);
    } else if (result) {
      showToast("success", "Voted successfully");
      handleDisplayAirlines(activeAccount, contract);
    }
  });
}

function handleFund(activeAccount, contract) {
  console.log("Fund for", activeAccount);
  console.log("Active account", activeAccount);
  contract.fundAirline(activeAccount, (error, result) => {
    if (error) {
      handleError(error);
    } else if (result) {
      showToast("success", "Funded, now you can register flights");
      handleDisplayMyAirline(activeAccount, contract);
      contract.getBalance((error, balance) => {
        console.log("Balance", contract.web3.utils.fromWei(balance, "ether"));
        console.log("error", error);
      });
    }
  });
}

function showToast(type, message) {
  const toast =
    type === "success" ? DOM.elid("success-toast") : DOM.elid("error-toast");

  const toastBootstrap = bootstrap.Toast.getOrCreateInstance(toast);
  toastBootstrap.show();
  const el =
    type === "success"
      ? DOM.elid("success-toast-body")
      : DOM.elid("error-toast-body");
  el.textContent = message;
}

function handleDisplayMyAirline(activeAccount, contract) {
  console.log("handleDisplayMyAirline - active acc", activeAccount);
  contract.isFundableAirline(activeAccount, (error, result) => {
    console.log("Is fundable", result);
    if (result) {
      const myAirlineEl = DOM.elid("my-airline-block");

      DOM.showEleId("my-airline-block", "block");
      const myAirline = createAirlineItem(
        activeAccount,
        result,
        activeAccount,
        contract,
        false,
        true
      );

      if (!myAirlineEl.childNodes.length) {
        const title = document.createElement("h3");
        title.textContent = "My airline";
        myAirlineEl.appendChild(title);
      }
      myAirlineEl.appendChild(myAirline);
    } else {
      DOM.hideAndRemoveEleId("my-airline-block");
    }
  });
}

function handleDisplayAirlines(
  activeAccount,
  contract,
  accountsChanged = false
) {
  contract.getListRegisteredAirlines(activeAccount, (error, airlines) => {
    console.log("Registered Airlines", airlines);
    const airlineList = [...airlines[0]] || [];
    const nameList = [...airlines[1].split(",")] || [];
    const myAirlineIdx = airlines[0].indexOf(activeAccount);

    console.log("My airline index", myAirlineIdx);

    if (myAirlineIdx > -1) {
      airlineList.splice(myAirlineIdx, 1);
      nameList.splice(myAirlineIdx, 1);
    }

    console.log("Airline list to display", airlineList);
    console.log("Name list to display", nameList);

    if (airlineList.length > 0) {
      const airlinesEl = DOM.elid("airlines-list");
      console.log("airlinesEl.childNodes.length", airlinesEl.childNodes.length);
      if (
        airlinesEl.childNodes.length !== airlineList.length ||
        airlinesEl.firstChild.textContent === "No airlines registered yet" ||
        accountsChanged
      ) {
        // Case init list
        if (!airlinesEl.childNodes.length) {
          console.log("Case Init list", airlineList);
          airlineList.forEach((airline) => {
            const airlineEl = createAirlineItem(
              airline,
              nameList[airlineList.indexOf(airline)],
              activeAccount,
              contract,
              true
            );
            airlinesEl.appendChild(airlineEl);
          });
        } else {
          console.log("Case update list", airlineList);
          if (airlinesEl.childNodes.length) airlinesEl.replaceChildren();

          for (let airline of airlineList) {
            const airlineEl = createAirlineItem(
              airline,
              nameList[airlineList.indexOf(airline)],
              activeAccount,
              contract,
              true
            );
            airlinesEl.appendChild(airlineEl);
          }
        }
      }
    } else {
      DOM.hideAndRemoveEleId("airlines-list");
      const airlinesEl = DOM.elid("airlines-list");
      const emptyEl = document.createElement("div");
      emptyEl.textContent = "No airlines registered yet";
      airlinesEl.appendChild(emptyEl);
      DOM.showEleId("airlines-list", "block");
    }
  });
}

function handleDisplayFlights(activeAccount, contract) {
  contract.getFlights(activeAccount, (error, flights) => {
    console.log("Flights", flights);

    if (flights[0].length > 0) {
      const flightKeys = [...flights[0]];
      const flightCodes = [...flights[1].split(",")];
      const departures = [...flights[2]];
      const airlineNames = [...flights[3].split(",")];
      const airlineAddress = [...flights[4]];

      const flightsEl = DOM.elid("flights-list");

      if (flightsEl.childNodes.length !== flights.length) {
        if (flightsEl.childNodes.length) flightsEl.replaceChildren();

        flightKeys.forEach((_, idx) => {
          const flightEl = createFlightItem(
            flightKeys[idx],
            flightCodes[idx],
            departures[idx],
            airlineNames[idx],
            airlineAddress[idx],
            activeAccount,
            contract
          );
          flightsEl.appendChild(flightEl);
        });
      }
    } else {
      DOM.hideAndRemoveEleId("flights-list");
      const flightsEl = DOM.elid("flights-list");
      const emptyEl = document.createElement("div");
      emptyEl.textContent = "No flights registered yet";
      flightsEl.appendChild(emptyEl);
      DOM.showEleId("flights-list", "block");
    }
  });
}

function createAirlineItem(
  address,
  name,
  activeAccount,
  contract,
  voteable = false,
  fundable = false
) {
  console.log("activeAccount", activeAccount);
  const airlineEl = document.createElement("div");
  airlineEl.className = "airline-item";

  const addressEl = document.createElement("div");
  addressEl.className = "airline-address";
  addressEl.textContent = address;

  const nameEl = document.createElement("div");
  nameEl.textContent = name;

  airlineEl.appendChild(addressEl);
  airlineEl.appendChild(nameEl);

  if (voteable) {
    const voteEl = document.createElement("div");
    voteEl.classList = ["btn btn-primary"];
    voteEl.textContent = "Vote";
    voteEl.addEventListener("click", () => {
      handleVote(address, activeAccount, contract);
    });
    airlineEl.appendChild(voteEl);
  }

  if (fundable) {
    const fundEl = document.createElement("div");
    fundEl.classList = ["btn btn-primary"];
    fundEl.textContent = "Fund";
    fundEl.addEventListener("click", () => {
      handleFund(activeAccount, contract);
    });
    airlineEl.appendChild(fundEl);
  }

  return airlineEl;
}

function createFlightItem(
  flightkey,
  flightCode,
  departure,
  airlineName,
  airlineAddress,
  activeAccount,
  contract
) {
  const flightEl = document.createElement("div");
  flightEl.className = "flight-item";

  const flightCodeEl = document.createElement("div");
  flightCodeEl.className = "flight-code";
  flightCodeEl.textContent = flightCode;

  const airlineEl = document.createElement("div");
  airlineEl.className = "flight-airline-name";
  airlineEl.textContent = airlineName;

  const departureEl = document.createElement("div");
  departureEl.textContent = formatDate(new Date(+departure));

  const buyEl = document.createElement("div");
  buyEl.classList = ["buy-insurance-block"];
  const buyBtn = document.createElement("button");
  buyBtn.classList = ["btn btn-primary buy-insurance-btn"];
  buyBtn.textContent = "Buy Insurance";
  buyBtn.addEventListener("click", () => {
    handleBuyInsurance(activeAccount, flightkey, contract);
  });
  const input = document.createElement("input");
  input.classList = ["form-control buy-insurance-input"];
  input.type = "number";
  input.placeholder = "Amount";
  input.min = 0;
  input.id = flightkey;
  buyEl.appendChild(input);
  buyEl.appendChild(buyBtn);

  const checkEl = document.createElement("div");
  checkEl.classList = ["btn btn-primary check-flight-btn"];
  checkEl.textContent = "Check status";
  checkEl.addEventListener("click", () => {
    handleGetFlightStatus(activeAccount, flightkey, airlineAddress, contract);
  });

  flightEl.appendChild(flightCodeEl);
  flightEl.appendChild(airlineEl);
  flightEl.appendChild(departureEl);
  flightEl.appendChild(buyEl);
  flightEl.appendChild(checkEl);

  return flightEl;
}

function handleDisplayPayments(activeAccount, contract) {
  contract.getInsuranceAmount(activeAccount, (error, payments) => {
    console.log("Payments", payments);

    if (payments > 0) {
      const creditEl = DOM.elid("my-credit");
      const creditAmount = contract.web3.utils.fromWei(payments, "ether");

      if (creditEl.childNodes.length) {
        creditEl.replaceChildren();
      }

      const creditTitle = document.createElement("h3");
      creditTitle.textContent = "My credit";
      creditEl.appendChild(creditTitle);

      const creditAmountEl = document.createElement("div");
      creditAmountEl.textContent = `${creditAmount} ETH`;
      creditEl.appendChild(creditAmountEl);

      const withdrawEl = document.createElement("button");
      withdrawEl.classList = ["btn btn-primary"];
      withdrawEl.textContent = "Withdraw";
      withdrawEl.addEventListener("click", () => {
        contract.withdraw(activeAccount, (error, result) => {
          if (error) {
            handleError(error);
          } else if (result) {
            showToast("success", "Withdrawn successfully");
            handleDisplayPayments(activeAccount, contract);
          }
        });
      });

      creditEl.appendChild(withdrawEl);
    } else {
      DOM.hideAndRemoveEleId("my-credit");
    }
  });
}

function handleBuyInsurance(activeAccount, flightkey, contract) {
  console.log("Buying insurance for", flightkey, activeAccount);

  const amount = DOM.elid(flightkey).value;
  if (!amount) {
    showToast("error", "Please enter the amount");
    return;
  }

  contract.buyInsurance(flightkey, amount, activeAccount, (error, result) => {
    if (error) {
      handleError(error);
    } else if (result) {
      showToast("success", "Insurance bought successfully");
    }
  });
}

function handleGetFlightStatus(
  activeAccount,
  flightCode,
  airlineAddress,
  contract
) {
  console.log("Getting status for", flightCode, activeAccount);

  contract.getFlightStatus(
    activeAccount,
    flightCode,
    airlineAddress,
    (error, result) => {
      if (error) {
        handleError(error);
      } else if (result) {
        console.log(result);
        showToast("success", "Flight status checked successfully");
        handleDisplayPayments(activeAccount, contract);
      }
    }
  );
}

function initDatePicker() {
  new AirDatepicker("#departure", {
    timepicker: true,
    locale: {
      // Define the locale settings here
      days: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      daysMin: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
      months: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ],
      monthsShort: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ],
      today: "Today",
      clear: "Clear",
      dateFormat: "MM/dd/yyyy",
      timeFormat: "hh:mm aa",
      firstDay: 0,
    },
  });
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function handleError(error) {
  let transformedError = error.message.replace("Returned error:", "");
  if (error.message.includes(REVERT_ERROR)) {
    showToast("error", transformedError.replace(REVERT_ERROR, ""));
  } else {
    showToast("error", transformedError);
  }
}

function display(title, description, results) {
  let displayDiv = DOM.elid("display-wrapper");
  let section = DOM.section();
  section.appendChild(DOM.h2(title));
  section.appendChild(DOM.h5(description));
  results.map((result) => {
    let row = section.appendChild(DOM.div({ className: "row" }));
    row.appendChild(DOM.div({ className: "col-sm-4 field" }, result.label));
    row.appendChild(
      DOM.div(
        { className: "col-sm-8 field-value" },
        result.error ? String(result.error) : String(result.value)
      )
    );
    section.appendChild(row);
  });
  displayDiv.append(section);
}
