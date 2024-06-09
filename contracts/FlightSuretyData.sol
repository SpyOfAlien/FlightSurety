pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner; // Account used to deploy contract
    bool private operational = true; // Blocks all state changes throughout the contract if false

    // Airline
    struct Airline {
        string name;
        bool isRegistered;
        bool isFunded;
        mapping(address => bool) votes;
        uint256 voteCount;
    }
    // Mapping for Airline
    mapping(address => Airline) private airlines;
    address[] public unconfirmedAirlines;
    address[] public fundedAirlinesAddress;
    uint256 public fundedAirlinesCount = 0;

    // Flight
    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        string flightCode;
        uint256 departure;
        address airline;
        mapping(address => uint256) insurees;
        address[] insureeAddress;
    }
    mapping(bytes32 => Flight) private flights;
    bytes32[] public flightKeys;

    // Passenger
    struct Passenger {
        uint256 amount;
        bool registered;
    }
    mapping(address => Passenger) private passengers;

    // Authorized Contracts Caller
    mapping(address => bool) private authorizedContracts;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner and the first airline is registered
     */
    constructor() public {
        contractOwner = msg.sender;
        // Register the first airline is the owner of the contract itself
        airlines[msg.sender] = Airline({
            isRegistered: true,
            name: "FlightSurety",
            isFunded: true,
            voteCount: 0
        });
        // Add the first airline to the list of airlines
        fundedAirlinesCount = fundedAirlinesCount.add(1);
        fundedAirlinesAddress.push(msg.sender);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    // Check authorized contract
    modifier requireAuthorizedContract() {
        require(
            authorizedContracts[msg.sender] == true,
            "Caller is not authorized"
        );
        _;
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    // Define a modifier that checks if airline is registered before
    modifier requireAirlineNotRegistered(address airline) {
        require(
            !airlines[airline].isRegistered,
            "Airline is already registered"
        );
        _;
    }

    // Define a modifier that checks if the msg.sender has been registered
    modifier requireAirlineRegistered(address airline) {
        require(airlines[airline].isRegistered, "Airline is not registered");
        _;
    }

    // Define a modifier that checks if the msg.sender has been funded
    modifier requireAirlineFunded(address account) {
        require(airlines[account].isFunded, "Airline is not funded");
        _;
    }

    // Define a modifier check that only passengers can buy insurance for a flight
    modifier requirePassenger(address passenger) {
        require(
            airlines[passenger].isRegistered == false,
            "Only passengers can buy insurance"
        );
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */
    function isOperational() public view returns (bool) {
        return operational;
    }

    function isAirlineFunded(address airline) public view returns (bool) {
        return airlines[airline].isFunded;
    }

    function isFlightRegistered(bytes32 flight) public view returns (bool) {
        return flights[flight].isRegistered;
    }

    function isFlightPayed(bytes32 flight) public view returns (bool) {
        return flights[flight].statusCode == 20;
    }

    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */
    // function setOperatingStatus(bool mode) external requireContractOwner {
    //     operational = mode;
    // }

    // Authorize a contract to call this contract
    function authorizeCaller(
        address contractAddress
    ) external requireContractOwner {
        authorizedContracts[contractAddress] = true;
    }

    // Deauthorize a contract to call this contract
    function deauthorizeCaller(
        address contractAddress
    ) external requireContractOwner {
        authorizedContracts[contractAddress] = false;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function registerAirline(
        address airlineAddress,
        string airlineName,
        address account
    )
        external
        requireIsOperational
        requireAirlineFunded(account)
        requireAirlineNotRegistered(airlineAddress)
    {
        if (fundedAirlinesCount < 4) {
            airlines[airlineAddress] = Airline({
                isRegistered: true,
                name: airlineName,
                isFunded: true,
                voteCount: 1
            });
            airlines[airlineAddress].votes[account] = true;
            fundedAirlinesCount = fundedAirlinesCount.add(1);
            fundedAirlinesAddress.push(airlineAddress);
        } else {
            airlines[airlineAddress] = Airline({
                isRegistered: true,
                name: airlineName,
                isFunded: false,
                voteCount: 1
            });
            airlines[airlineAddress].votes[account] = true;
            unconfirmedAirlines.push(airlineAddress);
        }
    }

    function voteAirline(
        address airlineAddress,
        address account
    ) external requireIsOperational requireAirlineFunded(account) {
        require(
            !airlines[airlineAddress].votes[account],
            "You has already voted for this airline"
        );

        airlines[airlineAddress].votes[account] = true;
        airlines[airlineAddress].voteCount = airlines[airlineAddress]
            .voteCount
            .add(1);

        if (airlines[airlineAddress].voteCount >= fundedAirlinesCount.div(2)) {
            removeAddress(airlineAddress);
        }
    }

    function registerFlight(
        string flight,
        uint256 departure,
        address airline
    ) external requireIsOperational requireAirlineFunded(airline) {
        bytes32 flightKey = getFlightKey(airline, flight, departure);
        flights[flightKey] = Flight({
            isRegistered: true,
            statusCode: 0,
            flightCode: flight,
            departure: departure,
            airline: airline,
            insureeAddress: new address[](0)
        });
        flightKeys.push(flightKey);
    }

    function getFlights()
        external
        view
        requireIsOperational
        returns (
            bytes32[] memory,
            string memory,
            uint256[] memory,
            string memory,
            address[] memory
        )
    {
        uint count = flightKeys.length;
        bytes32[] memory keys = new bytes32[](count);
        string memory codes = "";
        uint256[] memory departures = new uint256[](count);
        string memory airlineNames = "";
        address[] memory airlineAddress = new address[](count);

        for (uint i = 0; i < count; i++) {
            keys[i] = flightKeys[i];
            departures[i] = flights[flightKeys[i]].departure;
            airlineAddress[i] = flights[flightKeys[i]].airline;
            if (i > 0) {
                codes = string(abi.encodePacked(codes, ","));
                airlineNames = string(abi.encodePacked(airlineNames, ","));
            }
            codes = string(
                abi.encodePacked(codes, flights[flightKeys[i]].flightCode)
            );
            airlineNames = string(
                abi.encodePacked(
                    airlineNames,
                    airlines[flights[flightKeys[i]].airline].name
                )
            );
        }

        return (keys, codes, departures, airlineNames, airlineAddress);
    }

    function setOperatingStatus(bool mode) external {
        operational = mode;
    }

    /**
     * @dev Buy insurance for a flight
     *
     */
    function buyInsurance(
        bytes32 flightKey,
        address passenger
    ) external payable requireIsOperational requirePassenger(passenger) {
        require(
            msg.value <= 1 ether,
            "Insurance fee must be less than 1 ether"
        );
        require(flights[flightKey].isRegistered, "Flight is not registered");
        require(
            flights[flightKey].departure > now,
            "Flight has already departed"
        );
        require(
            flights[flightKey].insurees[passenger] == 0,
            "You have already bought insurance for this flight"
        );

        flights[flightKey].insurees[passenger] = msg.value;
        flights[flightKey].insureeAddress.push(passenger);
        if (passengers[passenger].registered == false) {
            passengers[passenger] = Passenger({amount: 0, registered: true});
        }
    }

    function updateFlightStatus(
        bytes32 flightKey,
        uint8 statusCode
    ) external requireIsOperational {
        flights[flightKey].statusCode = statusCode;
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees(bytes32 flightKey) external {
        require(flights[flightKey].statusCode == 20, "Flight is not delayed");

        // Get the flight
        Flight storage flight = flights[flightKey];
        uint count = flight.insureeAddress.length;
        for (uint i = 0; i < count; i++) {
            address passenger = flight.insureeAddress[i];
            uint256 amount = flight.insurees[passenger].mul(3).div(2);
            passengers[passenger].amount = passengers[passenger].amount.add(
                amount
            );
        }
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function withdraw(address passenger) external {
        uint256 amount = passengers[passenger].amount;
        require(amount > 0, "You have no payout");
        require(amount <= address(this).balance, "Contract has no balance");
        passengers[passenger].amount = 0;
        passenger.transfer(amount);
    }

    function getPayment(address passenger) external view returns (uint256) {
        return passengers[passenger].amount;
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fund(address airline) public payable requireIsOperational {
        require(
            msg.value >= 10 ether,
            "The funding amount must be at least 10 ether"
        );
        require(
            !airlines[airline].isFunded,
            "The airline has already been funded"
        );

        uint count = unconfirmedAirlines.length;
        for (uint i = 0; i < count; i++) {
            if (unconfirmedAirlines[i] == airline)
                revert("Your airline is not have enough votes to be funded");
        }

        airlines[airline].isFunded = true;
        fundedAirlinesCount = fundedAirlinesCount.add(1);
        fundedAirlinesAddress.push(msg.sender);
    }

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function getListRegisteredAirlines(
        address account
    )
        external
        view
        requireIsOperational
        requireAirlineRegistered(account)
        returns (address[] memory, string)
    {
        uint count = unconfirmedAirlines.length;
        address[] memory addresses = new address[](count);
        string memory names = "";

        for (uint i = 0; i < count; i++) {
            addresses[i] = unconfirmedAirlines[i];
            if (i > 0) {
                names = string(abi.encodePacked(names, ","));
            }
            names = string(
                abi.encodePacked(names, airlines[unconfirmedAirlines[i]].name)
            );
        }

        return (addresses, names);
    }

    function isFundableAirline(
        address account
    )
        external
        view
        requireIsOperational
        requireAirlineRegistered(account)
        returns (string)
    {
        if (airlines[account].isFunded) {
            return "";
        }

        uint length = unconfirmedAirlines.length;
        bool isFundable = true;

        for (uint i = 0; i < length; i++) {
            if (unconfirmedAirlines[i] == account) {
                isFundable = false;
            }
        }

        if (isFundable) {
            return airlines[account].name;
        } else {
            return "";
        }
    }

    // Function to remove an address from the array
    function removeAddress(address toRemove) public {
        uint length = unconfirmedAirlines.length;
        for (uint i = 0; i < length; i++) {
            if (unconfirmedAirlines[i] == toRemove) {
                // Replace the element to be removed with the last element in the array
                unconfirmedAirlines[i] = unconfirmedAirlines[length - 1];
                unconfirmedAirlines.length--; // Reduce the length of the array
                break; // Exit the loop after removing the element
            }
        }
    }

    function getAccountStatus(
        address account
    ) external view returns (bool, bool) {
        return (airlines[account].isRegistered, airlines[account].isFunded);
    }

    function getBalance() external view requireIsOperational returns (uint256) {
        return address(this).balance;
    }
}
