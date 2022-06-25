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

    address private paymentReceiver;
    bool private nativeCurrencyPermit;

    event DepositToken(address player, address quoteToken, uint256 amount);
    event DepositNativeCurrency(address player, string curreny, uint256 amount);
    event WithdrawTokenRequest(address player, address quoteToken, uint256 amount);
    event WithdrawNativeRequest(address player, string currency, uint256 amount);

    function depositToken(address _quoteToken, address _player, uint256 _amount) public {
        require(quoteToken[_quoteToken], 'Payment method is not allowed');
        TransferHelper.safeTransferFrom(_quoteToken, _msgSender(), paymentReceiver, _amount);
        emit DepositToken(_player, _quoteToken, _amount);
    }

    function depositNativeCurrency(address _player) public payable {
        require(nativeCurrencyPermit, 'Payment method not allowed');
        emit DepositNativeCurrency(_player, 'BNB', msg.value);
    }

    function withdrawTokenRequest(address _quoteToken, uint256 _amount) public {
        emit WithdrawTokenRequest(_msgSender(), _quoteToken, _amount);
    }

    function withdrawNativeRequest(uint256 _amount) public {
        emit WithdrawNativeRequest(_msgSender(), 'BNB', _amount);
    }

    function addQuoteToken(address _quoteToken) public onlyOwner returns (bool) {
        quoteToken[_quoteToken] = true;
        return true;
    }

    function setNativePermit(bool _status) public onlyOwner returns (bool) {
        nativeCurrencyPermit = _status;
        return true;
    }
    
    function getNativePermit() public view returns (bool) {
        return nativeCurrencyPermit;
    }

    function setPaymentReceiver(address _paymentReceiver) public onlyOwner returns (bool) {
        paymentReceiver = _paymentReceiver;
        return true;
    }

    function getPaymentReceiver() public view returns (address) {
        return paymentReceiver;
    }

    function transferAnyBEP20(address _tokenAddress, address _to, uint256 _amount) public virtual onlyOwner returns (bool) {
        IBEP20(_tokenAddress).transfer(_to, _amount);
        return true;
    }

    function adminWithdrawal(uint256 _amount) public virtual onlyOwner {
        address payable _owner = payable(owner());
        _owner.transfer(_amount);
    }


    function checkQuoteToken(address _quoteToken) public view returns (bool) {
        return quoteToken[_quoteToken];
    }
}