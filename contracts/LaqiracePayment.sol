//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';

import './TransferHelper.sol';

interface IBEP20 {
    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */

    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract LaqiracePayment is Ownable {
    mapping(address => bool) private quoteToken;
    mapping(uint256 => bool) private pendingRequests;

    address private paymentReceiver;
    uint256 private reqCounter;
    uint256[] private pendingReqs;

    event DepositToken(address player, address quoteToken, uint256 amount);
    event WithdrawRequest(address player, address quoteToken, uint256 amount, uint256 reqCounter);

    function deposit(address _quoteToken, address _player, uint256 _amount) public payable returns (bool) {
        require(quoteToken[_quoteToken], 'Payment method is not allowed');
        
        uint256 transferredAmount = msg.value;
        if (_quoteToken == TransferHelper.ETH_ADDRESS) {
            require(transferredAmount >= _amount, 'Insufficient paid amount');
            uint256 diff = transferredAmount  - _amount;
            if (diff > 0)
                TransferHelper.safeTransferETH(_msgSender(), diff);
        } else {
            require(transferredAmount == 0, 'Invalid payment method');
            TransferHelper.safeTransferFrom(_quoteToken, _msgSender(), paymentReceiver, _amount);
        }
        emit DepositToken(_player, _quoteToken, _amount);
        return true;
    }

    function withdrawRequest(address _quoteToken, uint256 _amount) public returns (bool) {
        require(quoteToken[_quoteToken], 'Asset is not allowed');
        reqCounter++;
        pendingRequests[reqCounter] = true;
        pendingReqs.push(reqCounter);
        emit WithdrawRequest(_msgSender(), _quoteToken, _amount, reqCounter);
        return true;
    }

    function addQuoteToken(address _quoteToken) public onlyOwner returns (bool) {
        quoteToken[_quoteToken] = true;
        return true;
    }

    function setPaymentReceiver(address _paymentReceiver) public onlyOwner returns (bool) {
        paymentReceiver = _paymentReceiver;
        return true;
    }
    
    function transferAnyBEP20(address _tokenAddress, address _to, uint256 _amount) public virtual onlyOwner returns (bool) {
        IBEP20(_tokenAddress).transfer(_to, _amount);
        return true;
    }
    
    function adminWithdrawal(uint256 _amount) public virtual onlyOwner {
        address payable _owner = payable(owner());
        _owner.transfer(_amount);
    }

    function getPaymentReceiver() public view returns (address) {
        return paymentReceiver;
    }

    function checkQuoteToken(address _quoteToken) public view returns (bool) {
        return quoteToken[_quoteToken];
    }
}
