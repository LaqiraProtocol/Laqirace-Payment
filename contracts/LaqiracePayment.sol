//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';

import './TransferHelper.sol';

contract LaqiracePayment is Ownable {
    mapping(address => bool) private quoteToken;

    address private paymentReceiver;

    function depositToken(address _quoteToken, address _player, uint256 _amount) public {
        require(quoteToken[_quoteToken], 'Payment method is not allowed');
        TransferHelper.safeTransferFrom(_quoteToken, _msgSender(), paymentReceiver, _amount);
        emit Deposit(_player, _quoteToken, _amount);
    }
}