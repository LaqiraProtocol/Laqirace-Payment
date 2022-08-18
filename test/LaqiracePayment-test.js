const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const { constants } = require('@openzeppelin/test-helpers');
const providerWaff = waffle.provider;

describe("LaqiracePayment", function () {
    let laqiracePayment, LaqiracePaymentContract, quoteToken, QuoteToken;
    let paymentReceiver, player, requestFee, operator, owner, anotherAddress, minAmount;

    const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    
    requestFee = '20000000000000000';
    minAmount = '2000000000000000000';
    
    beforeEach(async function () {
        [ owner, operator, anotherAddress, player ] = await ethers.getSigners();
        paymentReceiver = ethers.Wallet.createRandom();

        laqiracePayment = await ethers.getContractFactory("LaqiracePayment");
        quoteToken = await ethers.getContractFactory('QuoteToken');
        
        QuoteToken = await quoteToken.deploy('Quote', 'QT', '10000000000000000000000000000');
        LaqiracePaymentContract = await laqiracePayment.deploy(paymentReceiver.address, requestFee, operator.address);
    });


    it('Constructor', async function () {
        // paymentReceiver
        expect(await LaqiracePaymentContract.getPaymentReceiver()).to.equal(paymentReceiver.address);
        // request fee
        expect(await LaqiracePaymentContract.getReqFee()).to.equal(requestFee);
        // operator
        expect(await LaqiracePaymentContract.getOperator()).to.equal(operator.address);
    });

    describe('addQuoteToken', function() {
        it('Trigger', async function () {
            await LaqiracePaymentContract.addQuoteToken(QuoteToken.address, minAmount);
            const result = await LaqiracePaymentContract.checkQuoteToken(QuoteToken.address);
            expect(result['isAvailable']).to.true;
            expect(result['minAmount']).to.equal(minAmount);
        });

        it('ERRORS', async function () {
            await LaqiracePaymentContract.addQuoteToken(QuoteToken.address, minAmount);
            await expect(LaqiracePaymentContract.addQuoteToken(QuoteToken.address, minAmount)).to.revertedWith('Asset already exists');
        });

        it('onlyOwner', async function () {
            await expect(LaqiracePaymentContract.connect(anotherAddress).addQuoteToken(QuoteToken.address, minAmount)).to.revertedWith('Ownable: caller is not the owner');
        });
    });

    describe('removeQuoteToken', function () {        
        it('Trigger', async function () {
            await LaqiracePaymentContract.addQuoteToken(QuoteToken.address, minAmount);
            await LaqiracePaymentContract.removeQuoteToken(QuoteToken.address);
            const result = await LaqiracePaymentContract.checkQuoteToken(QuoteToken.address);
            expect(result['isAvailable']).to.false;
            expect(result['minAmount']).to.equal(0);
        });
        
        it('ERRORS', async function () {
            expect((await LaqiracePaymentContract.checkQuoteToken(QuoteToken.address))['isAvailable']).to.false;
            await expect(LaqiracePaymentContract.removeQuoteToken(QuoteToken.address)).to.revertedWith('Asset already does not exist');
        });
    });

    describe('updateMinAmount', function () {
        let newAmount = '5000000000000000000';
        it('Trigger', async function () {
            await LaqiracePaymentContract.updateMinAmount(QuoteToken.address, newAmount);
            expect((await LaqiracePaymentContract.checkQuoteToken(QuoteToken.address))['minAmount']).to.equal(newAmount);
        });
    });

    describe('updatePaymentReceiver', function () {
        let newPaymentReceiver = ethers.Wallet.createRandom();
        it('Trigger', async function () {
            await LaqiracePaymentContract.updatePaymentReceiver(newPaymentReceiver.address);
            expect(await LaqiracePaymentContract.getPaymentReceiver()).to.equal(newPaymentReceiver.address);
        });
        
        it('Zero address', async function () {
            await LaqiracePaymentContract.updatePaymentReceiver(constants.ZERO_ADDRESS);
            expect(await LaqiracePaymentContract.getPaymentReceiver()).to.equal(constants.ZERO_ADDRESS);
        });
    });

    describe('deposit', function () {
        let invalidAmount = '20000';
        it('Trigger -> Token', async function () {
            await LaqiracePaymentContract.addQuoteToken(QuoteToken.address, minAmount);
            await QuoteToken.transfer(player.address, minAmount);
            await QuoteToken.connect(player).approve(LaqiracePaymentContract.address, minAmount);
           
            await expect(LaqiracePaymentContract.connect(player).deposit(QuoteToken.address, player.address, minAmount)).to.emit(LaqiracePaymentContract, 'DepositToken').withArgs(player.address, QuoteToken.address, minAmount);
            
            let contractBalance = await QuoteToken.balanceOf(LaqiracePaymentContract.address);
            let paymentReceiverBalance = await QuoteToken.balanceOf(paymentReceiver.address);
            expect(contractBalance).to.equal(0);
            expect(paymentReceiverBalance).to.equal(minAmount);
        });

        it('Trigger -> BNB (payback)', async function () {
            let extraAmount = '5000000000000000000';
            await LaqiracePaymentContract.addQuoteToken(ETH_ADDRESS, minAmount);
            await LaqiracePaymentContract.connect(player).deposit(ETH_ADDRESS, player.address, minAmount, {value: extraAmount});
            expect(await providerWaff.getBalance(LaqiracePaymentContract.address)).to.equal(minAmount);
        });

        it('ERRORS', async function () {
            await expect(LaqiracePaymentContract.deposit(QuoteToken.address, player.address, minAmount)).to.revertedWith('Payment method is not allowed');
            await LaqiracePaymentContract.addQuoteToken(ETH_ADDRESS, minAmount);
            await LaqiracePaymentContract.addQuoteToken(QuoteToken.address, minAmount);
            await expect(LaqiracePaymentContract.deposit(ETH_ADDRESS, player.address, minAmount, {value: invalidAmount})).to.revertedWith('Insufficient paid amount');
            await expect(LaqiracePaymentContract.deposit(QuoteToken.address, player.address, minAmount, {value: minAmount})).to.revertedWith('Invalid payment method'); 
        });
    });

    describe('withdrawRequest', async function () {
        let withdrawReqestAmount = minAmount;
        let expectedRequestId = 1;
        it('Trigger -> (BNB, Token)', async function () {
            await LaqiracePaymentContract.addQuoteToken(QuoteToken.address, minAmount);
            await LaqiracePaymentContract.addQuoteToken(ETH_ADDRESS, minAmount);
            await expect(LaqiracePaymentContract.connect(player).withdrawRequest(QuoteToken.address, withdrawReqestAmount, {value: requestFee})).to.emit(LaqiracePaymentContract, 'WithdrawRequest').withArgs(player.address, QuoteToken.address, withdrawReqestAmount, expectedRequestId);
            let LaqiracePaymentContractBalance = await providerWaff.getBalance(LaqiracePaymentContract.address);
            expect(LaqiracePaymentContractBalance).to.equal(requestFee);

            let requestStatus = await LaqiracePaymentContract.getReqStatus(expectedRequestId);
            expect(requestStatus['isPending']).to.true;
            expect(requestStatus['player']).to.equal(player.address);
            expect(requestStatus['quoteToken']).to.equal(QuoteToken.address);
            expect(requestStatus['amount']).to.equal(withdrawReqestAmount);

            expect((await LaqiracePaymentContract.getPendingReqs()).length).to.equal(1);
            expect((await LaqiracePaymentContract.getPendingReqs())[0]).to.equal(1);

            await LaqiracePaymentContract.connect(player).withdrawRequest(ETH_ADDRESS, withdrawReqestAmount, {value: requestFee});
            expect((await LaqiracePaymentContract.getPendingReqs()).length).to.equal(2);
            expect((await LaqiracePaymentContract.getPendingReqs())[1]).to.equal(2);
        });

        it('ERRORS', async function () {
            let invalidAmount = '200000';
            let insufficientRequestFeeAmount = '100';
            await expect(LaqiracePaymentContract.connect(player).withdrawRequest(QuoteToken.address, withdrawReqestAmount, {value: requestFee})).to.revertedWith('Asset is not allowed');
            await LaqiracePaymentContract.addQuoteToken(QuoteToken.address, minAmount);
            await expect(LaqiracePaymentContract.connect(player).withdrawRequest(QuoteToken.address, invalidAmount, {value: requestFee})).to.revertedWith('Amount is lower than minimum required');
            await expect(LaqiracePaymentContract.connect(player).withdrawRequest(QuoteToken.address, minAmount, {value: insufficientRequestFeeAmount})).to.revertedWith('Insufficient request fee');
        })
    });

    describe('confirmRequest', function () {
        let expectedRequestId = 1;
        it('Trigger', async function () {
            await LaqiracePaymentContract.addQuoteToken(QuoteToken.address, minAmount);
            await LaqiracePaymentContract.connect(player).withdrawRequest(QuoteToken.address, minAmount, {value: requestFee});

            // player -> approve -> deposit -> withdrawRequest -> confirmRequest (admin)
            await QuoteToken.transfer(LaqiracePaymentContract.address, minAmount);
            let requestStatus = await LaqiracePaymentContract.getReqStatus(expectedRequestId);
            expect(await QuoteToken.balanceOf(player.address)).to.equal(0);
            await expect(LaqiracePaymentContract.connect(operator).confirmRequest(expectedRequestId)).to.emit(LaqiracePaymentContract, 'RequestConfirmed').withArgs(requestStatus['player'], requestStatus['quoteToken'], requestStatus['amount'], expectedRequestId);
            expect(await QuoteToken.balanceOf(player.address)).to.equal(minAmount);
           
            let newRequestStatus = await LaqiracePaymentContract.getReqStatus(expectedRequestId);
            expect(newRequestStatus['isPending']).to.false;
            expect(requestStatus['player']).to.equal(player.address);
            expect(requestStatus['quoteToken']).to.equal(QuoteToken.address);
            expect(requestStatus['amount']).to.equal(minAmount);
            
            expect((await LaqiracePaymentContract.getPendingReqs()).length).to.equal(0);
        });

        it('ERRORS', async function () {
            let reqId = 1;
            await expect(LaqiracePaymentContract.connect(player).confirmRequest(reqId)).to.revertedWith('Permission denied!');
            await LaqiracePaymentContract.addQuoteToken(QuoteToken.address, minAmount);
            await QuoteToken.transfer(LaqiracePaymentContract.address, minAmount);
            await expect(LaqiracePaymentContract.connect(operator).confirmRequest(reqId)).to.revertedWith('Not a pending request');
        });
    });

    describe('rejectRequest', function () {
        it('Trigger', async function () {
            let expectedRequestId = 1;
            await LaqiracePaymentContract.addQuoteToken(QuoteToken.address, minAmount);
            await LaqiracePaymentContract.connect(player).withdrawRequest(QuoteToken.address, minAmount, {value: requestFee});
            
            let requestStatus = await LaqiracePaymentContract.getReqStatus(expectedRequestId);
            await expect(LaqiracePaymentContract.rejectRequest(expectedRequestId)).to.emit(LaqiracePaymentContract, 'RequestRejected').withArgs(requestStatus['player'], requestStatus['quoteToken'], requestStatus['amount'], '1');
            
            let newRequestStatus = await LaqiracePaymentContract.getReqStatus(expectedRequestId);
            expect(newRequestStatus['isPending']).to.false;
            expect(requestStatus['player']).to.equal(player.address);
            expect(requestStatus['quoteToken']).to.equal(QuoteToken.address);
            expect(requestStatus['amount']).to.equal(minAmount);
            
            expect((await LaqiracePaymentContract.getPendingReqs()).length).to.equal(0);
        });

        it('ERRORS', async function () {
            let reqId = 1;
            await expect(LaqiracePaymentContract.connect(player).rejectRequest(reqId)).to.revertedWith('Permission denied!');
            await expect(LaqiracePaymentContract.connect(owner).rejectRequest(reqId)).to.revertedWith('Not a pending request');
        });
    });
});