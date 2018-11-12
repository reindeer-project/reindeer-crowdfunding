const fs = require('fs');
const moment = require("moment");
const ReindeerCrowdsale = artifacts.require('./ReindeerCrowdsale.sol');
const ReindeerFund = artifacts.require('./ReindeerFund.sol');
const ReindeerToken = artifacts.require('./testlib/ReindeerToken.sol');
const { toWei, timeTravel, timeLeap, should, BigNumber} = require('./utils/reindeerHelper');
const fundParams = JSON.parse(fs.readFileSync('./config/ReindeerFund.json', 'utf8'));
const { assertThrows } = require('./utils/assertThrows');
const crowdsaleParams = JSON.parse(fs.readFileSync('./config/ReindeerCrowdsale.json', 'utf8'));

function timeConverter(UNIX_timestamp){
  var a = new Date(UNIX_timestamp * 1000);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour = a.getHours();
  var min = a.getMinutes();
  var sec = a.getSeconds();
  var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
  return time;
}

async function deployContract(openingtime,closingtime,salesPeriod,goal, someEther, fundOwners) {
    const actualCap = toWei(crowdsaleParams.cap);
    const actualGoal = toWei(goal);
    const actualMinUserCap = [toWei(crowdsaleParams.minUserCap[0]),toWei(crowdsaleParams.minUserCap[1])];
    const actualMaxUserCap = [toWei(crowdsaleParams.maxUserCap[0]),toWei(crowdsaleParams.maxUserCap[1])];
    const actualMaxTokenSupply = toWei(crowdsaleParams.maxTokenSupply);
    const actualPreTokenSupply = toWei(crowdsaleParams.preTokenSupply);
    const actualInitialFundBalance = toWei(crowdsaleParams.initialFundBalance);

    const obj = [];
    obj["token"] = await ReindeerToken.new();
    obj["fund"] = await ReindeerFund.new(fundOwners,fundParams.required);
    obj["crowdsale"] = await ReindeerCrowdsale.new(
      openingtime, 
      closingtime,
      salesPeriod,
      crowdsaleParams.rates, 
      actualCap,
      actualGoal,
      actualMaxTokenSupply,
      actualPreTokenSupply,
      actualMinUserCap,
      actualMaxUserCap,
      obj["fund"].address,
      obj["token"].address
    );
    await obj["token"].mint(obj["fund"].address,actualInitialFundBalance);
    //Crowdsale contract need to transfer tokens for purchase within buyToken process!
    await obj["token"].transferOwnership(obj["crowdsale"].address);
    return obj;
}


contract('ReindeerCrowdsale', (accounts) => {
  var someEther = toWei(1);

  before(async () => {
  })
  beforeEach(async function () {
  }) 
  afterEach(async function () 
  {
  })
  
  describe('1) Walkthrough.', function() {
    context('--FAILURE', ()=> {
      it('Prepare new contracts', async function () {
        const d = 60*60*24;
        const currenttime = web3.eth.getBlock('latest').timestamp + 100*d;
        const goal = 3000; //Dummy value for test
        this.openingtime = currenttime + 5*d;
        this.openingtime = currenttime + 5*d;
        this.salesPeriod =[0,0,0,0];
        this.salesPeriod[0]= this.openingtime + 7*d;
        this.salesPeriod[1]= this.openingtime + 14*d;
        this.salesPeriod[2]= this.openingtime + 21*d;
        this.salesPeriod[3]= this.openingtime + 28*d;
        this.closingtime = this.openingtime + 35*d;
        this.presaledAt = this.openingtime;
        this.FirstWeek  = this.openingtime + 7*d; //7days after openingtime
        this.SecondWeek = this.openingtime + 7*d + 7*d;
        this.ThirdWeek  = this.openingtime + 7*d + 7*d + 7*d;
        this.ForthWeek  = this.openingtime + 7*d + 7*d + 7*d + 7*d;
        this.fundOwners=[];
        for (id = 0; id <4; id++){
          this.fundOwners.push(accounts[id])
        }  
        obj = await deployContract(this.openingtime,this.closingtime,this.salesPeriod,goal, someEther,this.fundOwners);
	      this.crowdsale=obj["crowdsale"];
	      this.token=obj["token"];
        this.fund=obj["fund"];
        //Setup users
        this.prewhitelisted=[];
        this.whitelisted=[];
        this.anonymous=[];
        for (id = 3; id <6; id++){
          this.prewhitelisted.push(accounts[id])
        }
        await obj["crowdsale"].addManyToWhitelist(this.prewhitelisted);
        await obj["crowdsale"].setGroupCap(this.prewhitelisted, toWei(40000));
        for (id = 6; id <8; id++){
          this.whitelisted.push(accounts[id])
        }
        await obj["crowdsale"].addManyToWhitelist(this.whitelisted);
        await obj["crowdsale"].setGroupCap(this.whitelisted, toWei(80));
        for (id = 8; id <10; id++){
          this.anonymous.push(accounts[id])
        }
	      //const testtime = web3.eth.getBlock('latest').timestamp;
	      //console.log("          at: " + timeConverter(testtime));
      });
      it('BeforeOpen: Check the token ownership control', async function () {
        await obj["crowdsale"].resetTokenOwnership({ from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        var ownership = await obj["token"].owner();
        //Check the token ownership control
        await obj["crowdsale"].resetTokenOwnership().should.be.fulfilled; //change ownership to CloudSale contract's owner
        var ownership = await obj["token"].owner();
        await obj["token"].transferOwnership(obj["crowdsale"].address); //change ownership to CloudSale contract
        await assert.equal(ownership, accounts[0]);
      });

      it('BeforeOpen: Default exchange rate is 2,000/eth', async function () {
        const actual = await this.crowdsale.getRate();
        await assert.equal(actual, 2000);
      });
      it('BeforeOpen: Initially, reindeer fund has 400,000,000 tokens.', async function () {
        const actual = await this.token.balanceOf(this.fund.address);
        await assert.equal(actual, toWei(400000000));
      });
      it('BeforeOpen: Unwhitelisted member can not buy the token.', async function () {
        await this.crowdsale.send(someEther,{from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { from: this.anonymous[0], value: someEther }).should.be.rejectedWith(assertThrows);
      });
      it('BeforeOpen: Whitelisted member allowed under 80 can not buy the token.', async function () {
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { from: this.whitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
      });
      it('BeforeOpen: Whitelisted member allowed over 40000 can not buy the token.', async function () {
        await this.crowdsale.send(someEther,{from: this.prewhitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[0], { from: this.prewhitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
      });
      it('BeforeOpen: Not the owner can not add new members to the whitelist.', async function () {
        await this.crowdsale.addToWhitelist(this.anonymous[0], {from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        let isAuthorized = await this.crowdsale.whitelist(this.anonymous[0]);
        isAuthorized.should.equal(false);
      });
      it('BeforeOpen: Owner can add new members to the whitelist.', async function () {
        await this.crowdsale.addToWhitelist(this.anonymous[1]).should.be.fulfilled;
        let isAuthorized = await this.crowdsale.whitelist(this.anonymous[1]);
        isAuthorized.should.equal(true);
      });
      it('PreSale: Prepared', async function () {
        const now = web3.eth.getBlock('latest').timestamp;
        const diff = this.presaledAt - now;
        await timeLeap(diff);     
      });
      it('PreSale: Default exchange rate is 2,000/eth', async function () {
        const actual = await this.crowdsale.getRate();
        await assert.equal(actual, 2000);
      });
      it('PreSale: Unwhitelisted member can not buy the token.', async function () {
        await this.crowdsale.send(someEther,{from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { from: this.anonymous[0], value: someEther }).should.be.rejectedWith(assertThrows);
      });
      it('PreSale: Whitelisted member allowed under 40000 can not buy the token.', async function () {
        someEther = toWei(0.4);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { from: this.whitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
        someEther = toWei(2);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { from: this.whitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
        someEther = toWei(80);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { from: this.whitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
        someEther = toWei(40000);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { from: this.whitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
      });
      it('PreSale: Whitelisted member allowed over 40000 can buy the token.', async function () {
        for (i = 0; i <2; i++){
          someEther = toWei(0.1);  //under the minUserCap of whitelisted.     
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);
          await this.crowdsale.buyTokens(this.prewhitelisted[i], { from: this.prewhitelisted[i], value: someEther }).should.be.rejectedWith(assertThrows);
          someEther = toWei(0.4);  //minUserCap of whitelisted.  
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);
          await this.crowdsale.buyTokens(this.prewhitelisted[i], { from: this.prewhitelisted[i], value: someEther }).should.be.rejectedWith(assertThrows);
          someEther = toWei(2);   //minUserCap of prewhitelisted.    
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);
          await this.crowdsale.buyTokens(this.prewhitelisted[i], { from: this.prewhitelisted[i], value: someEther }).should.be.fulfilled;
          someEther = toWei(98);  //maxUserCap of prewhitelisted.       
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);          
          await this.crowdsale.buyTokens(this.prewhitelisted[i], { from: this.prewhitelisted[i], value: someEther }).should.be.fulfilled;
          const x = await this.crowdsale.getUserContribution(this.prewhitelisted[i]);
          await assert.equal(x, toWei(100)); //Total bought volume is the same as maxUserCap.
        };
      });

      it('1stTerm: Prepared', async function () {
        const now = web3.eth.getBlock('latest').timestamp;
        const diff = this.FirstWeek - now;
        await timeLeap(diff);        
      });
      it('1stTerm: Exchange rate is correct', async function () {
        const actual = await this.crowdsale.getRate();
        await assert.equal(actual, 1500);
        //const testtime = web3.eth.getBlock('latest').timestamp;
	      //console.log("          at: " + timeConverter(testtime));
      });
      it('1stTerm: Only the whitelisted member can buy the token.', async function () {
        someEther=toWei(0); 
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(0.39); 
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(0.4);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.fulfilled;
        someEther=toWei(99.6);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;

        //Not allowed finalize
        await this.crowdsale.finalize({gas:500000}).should.be.rejectedWith(assertThrows);
      });
      it('2ndTerm: Prepared', async function () {
        const now = web3.eth.getBlock('latest').timestamp;
        const diff = this.SecondWeek - now;
        await timeLeap(diff);
      });
      it('2ndTerm: Exchange rate is correct', async function () {
        const actual = await this.crowdsale.getRate();
        await assert.equal(actual, 1250);
      });
      it('2ndTerm: Only the whitelisted member can buy the token.', async function () {
        someEther=toWei(0.39); 
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(0.4);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.fulfilled;
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;
        someEther=toWei(99.6);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;

        //Not allowed finalize
        await this.crowdsale.finalize({gas:500000}).should.be.rejectedWith(assertThrows);
      });
      it('3rdTerm: Prepared', async function () {
        const now = web3.eth.getBlock('latest').timestamp;
        const diff = this.ThirdWeek - now;
        await timeLeap(diff);     
      });
      it('3rdTerm: Exchange rate is correct', async function () {
        const actual = await this.crowdsale.getRate();
        await assert.equal(actual, 1100);

      });
      it('3rdTerm: Only the whitelisted member can buy the token.', async function () {
        someEther=toWei(0.39); 
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(0.4);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.fulfilled;
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;
        someEther=toWei(99.6);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;

        //Not allowed finalize
        await this.crowdsale.finalize({gas:500000}).should.be.rejectedWith(assertThrows);
      });
 
      it('4thTerm: Prepared', async function () {
        const now = web3.eth.getBlock('latest').timestamp;
        const diff = this.ForthWeek - now;
        await timeLeap(diff);     
      });
      it('4thTerm: Exchange rate is correct', async function () {
        const actual = await this.crowdsale.getRate();
        await assert.equal(actual, 1000);

      });
      it('4thTerm: Only the whitelisted member can buy the token.', async function () {
        someEther=toWei(0.39); 
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(0.4);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.fulfilled;
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;
        someEther=toWei(99.6);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;
        someEther=toWei(99);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;
        someEther=toWei(78.4);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.fulfilled;
      });
 
      it('Closed: Prepared', async function () {
        const now = web3.eth.getBlock('latest').timestamp;
        const diff = this.closingtime - now + 1;
        await timeLeap(diff);   
      });
      it('Closed: Exchange rate is correct', async function () {
        const actual = await this.crowdsale.getRate();
        await assert.equal(actual, 1000);
      });
      it('Out of Date: Nobody can buy the token.', async function () {
        someEther=toWei(0.09); 
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(0.4);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(2);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(100);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
      });


      it('Finalize', async function () {
        //Closed
        const actual1 = web3.fromWei(await web3.eth.getBalance(await this.crowdsale.vault()).toNumber(),"ether");
        await assert.notEqual(actual1, 0);
        const actual2 = web3.fromWei(await web3.eth.getBalance(this.fund.address).toNumber(),"ether");
        await assert.equal(actual2, 0);
        //Not refundable
        const ref1 = web3.fromWei(await web3.eth.getBalance(await this.whitelisted[0]).toNumber(),"ether");
        await this.crowdsale.claimRefund({from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        const ref2 = web3.fromWei(await web3.eth.getBalance(await this.whitelisted[0]).toNumber(),"ether");
        await assert.isAbove(ref1, ref2);

        //Finalize
        //const gas2 = await this.crowdsale.finalize.estimateGas();
        //console.log(gas2+"unit, " + gas2*0.0000005*80000+"JPY");

        await this.crowdsale.finalize().should.be.fulfilled;
        const actual3 = web3.fromWei(await web3.eth.getBalance(await this.crowdsale.vault()).toNumber(),"ether");
        await assert.notEqual(actual3, 0);
        const actual4 = web3.fromWei(await web3.eth.getBalance(this.fund.address).toNumber(),"ether");
        await assert.equal(actual4, 0);
        //Finalize need to be work at once.
        await assert.equal(actual1, actual3); //same eth sent to the wallet.
        await assert.equal(actual2, actual4); //same eth sent to the wallet.
        await this.crowdsale.finalize().should.be.rejectedWith(assertThrows);
        someEther = toWei(0.1);
        await this.crowdsale.buyTokens(this.whitelisted[0], { from: this.whitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
        //Refund
        const gas3 = await this.crowdsale.claimRefund.estimateGas({from: this.whitelisted[0]});
        const gasprice = 100000000000;
        const gas4 = gas3*gasprice/1000000000000000000;
        //console.log(gas3+"unit, " + gas4+"ETH");
        const cnt = await this.crowdsale.getUserContribution(this.whitelisted[0]);
        const ref3 = web3.fromWei(cnt.toNumber(),"ether");
        //console.log(ref3);
        const ref4 = web3.fromWei(await web3.eth.getBalance(await this.whitelisted[0]).toNumber(),"ether");
        await this.crowdsale.claimRefund({from: this.whitelisted[0]}).should.be.fulfilled;
        const ref5 = web3.fromWei(await web3.eth.getBalance(await this.whitelisted[0]).toNumber(),"ether");
        const ref6 = Number(ref3) -Number(gas4)+ Number(ref4);
        //console.log("CURRENT:"+ref4+", ESTIMATED:"+ref6+", REFUNDED:"+ref5);
        //await assert.equal(ref6,ref5);
        await assert.isAbove(ref5,ref4);

      });
      it('Mint after finalized', async function () {
        await obj["crowdsale"].resetTokenOwnership().should.be.fulfilled;
        const fundA = await this.token.balanceOf(this.fund.address);
        const total3 = await this.token.totalSupply();
        const mintbalance = total3*0.1/12;
        await obj["token"].mint(obj["fund"].address,toWei(1000000));
        const fundB = await this.token.balanceOf(this.fund.address);
        const total4 = await this.token.totalSupply();
        await assert.isAbove(total4.toNumber(),total3.toNumber());
        await assert.isAbove(fundB.toNumber(),fundA.toNumber());
        //console.log(total3+" << "+total4);
        //console.log(fundA+" << "+fundB);
      });
    })
  })
})
