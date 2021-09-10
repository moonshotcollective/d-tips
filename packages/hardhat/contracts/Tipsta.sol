//SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./TokenDistributor.sol";

/// @title Token Distributor Contract
/// @author @ghostffcode
/// @notice distributes donations or tips
contract Tipsta is Ownable {
    using SafeMath for uint256;

    uint256 public tipperCost = 0.1 ether;
    address public fundsAccount;
    TokenDistributor tokenDistributorContract;

    // ERC-20 token address mapping to cost - makes it possible to pay with ETh and other tokens
    mapping(address => uint256) costs;

    modifier paidEnough() {
        require(
            msg.value >= tipperCost,
            "Not enough funds for this transaction"
        );
        _;
    }

    modifier tokenPaidEnough(address token, uint256 amount) {
        require(costs[token] > 0, "This token is not approved to be used here");
        require(
            costs[token] == amount,
            "You are not paying the exact cost for this token"
        );
        _;
    }

    constructor(
        TokenDistributor distributor,
        address holder,
        uint256 cost
    ) public {
        updateTokenDistributorAddress(distributor);
        updateFundsAccount(holder);
        updateTipstaCost(cost);
    }

    function updateFundsAccount(address holder) public onlyOwner {
        require(
            holder != address(0),
            "You can't send funds to the Genesis account"
        );
        fundsAccount = holder;
    }

    function updateTipstaCost(uint256 cost) public onlyOwner {
        require(cost > 0, "You really want to fund public goods");
        tipperCost = cost;
    }

    function updateTipstaCost(IERC20 token, uint256 cost) public onlyOwner {
        costs[address(token)] = cost;
    }

    function updateTokenDistributorAddress(TokenDistributor distributor)
        public
        onlyOwner
    {
        tokenDistributorContract = distributor;
    }

    function becomeATipsta() public payable paidEnough {
        // pay fee to fundsAccount
        (bool sent, ) = fundsAccount.call{value: tipperCost}("");
        require(sent, "Unable to pay tipsta fee");

        // add caller as new distributor
        addDistributor(msg.sender);

        // refund user for excess ETH
        uint256 refund = msg.value.sub(tipperCost);
        if (refund > 0) {
            (bool refunded, ) = msg.sender.call{value: refund}("");
            require(refunded, "Unable to refund excess ETH");
        }
    }

    function becomeATipsta(IERC20 token, uint256 amount)
        public
        tokenPaidEnough(address(token), amount)
    {
        require(
            token.allowance(msg.sender, address(this)) >= amount,
            "Please approve Tipsta contract as token spender"
        );
        require(
            token.balanceOf(msg.sender) >= amount,
            "You don't have enough token balance"
        );

        // make the transfer
        token.transferFrom(msg.sender, fundsAccount, amount);
        // make distributor
        addDistributor(msg.sender);
    }

    function addDistributor(address _user) private {
        tokenDistributorContract.addNewDistributor(_user);
    }
}
