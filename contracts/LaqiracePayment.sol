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
    struct assetStatus {
        bool isAvailable;
        uint256 minAmount;
    }
    
    struct reqStatus {
        bool isPending;
        address player;
        address quoteToken;
        uint256 amount;
    }

    mapping(address => assetStatus) private quoteToken;
    mapping(uint256 => reqStatus) private withdrawReqs;

    address private paymentReceiver;
    uint256 private reqCounter;
    uint256[] private pendingReqs;
    uint256 private reqFee;
    address private operator;

    event DepositToken(address player, address quoteToken, uint256 amount);
    event WithdrawRequest(address player, address quoteToken, uint256 amount, uint256 reqCounter);

    function deposit(address _quoteToken, address _player, uint256 _amount) public payable returns (bool) {
        require(quoteToken[_quoteToken].isAvailable, 'Payment method is not allowed');
        
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

    function withdrawRequest(address _quoteToken, uint256 _amount) public payable returns (bool) {
        require(quoteToken[_quoteToken].isAvailable, 'Asset is not allowed');
        require(_amount >= quoteToken[_quoteToken].minAmount, 'Amount is lower than minimum required');
        uint256 transferredAmount = msg.value;
        require(transferredAmount >= reqFee, 'Insufficient request fee');
        
        uint256 diff = transferredAmount  - reqFee;
        if (diff > 0)
            TransferHelper.safeTransferETH(_msgSender(), diff);
        reqCounter++;
        withdrawReqs[reqCounter].isPending = true;
        withdrawReqs[reqCounter].player = _msgSender();
        withdrawReqs[reqCounter].quoteToken = _quoteToken;
        withdrawReqs[reqCounter].amount = _amount;
        pendingReqs.push(reqCounter);
        emit WithdrawRequest(_msgSender(), _quoteToken, _amount, reqCounter);
        return true;
    }

    function addQuoteToken(address _quoteToken, uint256 _minAmount) public onlyOwner returns (bool) {
        require(!quoteToken[_quoteToken].isAvailable, 'Asset already exists');
        quoteToken[_quoteToken].isAvailable = true;
        quoteToken[_quoteToken].minAmount = _minAmount;
        return true;
    }
    
    function removeQuoteToken(address _quoteToken) public onlyOwner returns (bool) {
        require(quoteToken[_quoteToken].isAvailable, 'Asset already does not exist');
        delete quoteToken[_quoteToken];
        return true;
    }
    
    function updateMinAmount(address _quoteToken, uint256 _minAmount) public onlyOwner returns (bool) {
        quoteToken[_quoteToken].minAmount = _minAmount;
        return true;
    }

    function setPaymentReceiver(address _paymentReceiver) public onlyOwner returns (bool) {
        paymentReceiver = _paymentReceiver;
        return true;
    }
    
    function updateReqFee(uint256 _reqFee) public onlyOwner returns (bool) {
        reqFee = _reqFee;
        return true;
    }
    
    function changeOperator(address _newOperator) public onlyOwner returns (bool) {
        operator = _newOperator;
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

    function checkQuoteToken(address _quoteToken) public view returns (bool, uint256) {
        return (quoteToken[_quoteToken].isAvailable, quoteToken[_quoteToken].minAmount);
    }
    
    function getPendingReqs() public view returns (uint256[] memory) {
        return pendingReqs;
    }
    
    function getReqFee() public view returns (uint256) {
        return reqFee;
    }
    
    function getOperator() public view returns (address) {
        return operator;
    }
}
