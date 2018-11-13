const fs = require('fs');
const moment = require("moment");
const ReindeerCrowdsale = artifacts.require('./ReindeerCrowdsale.sol');
const ReindeerFund = artifacts.require('./ReindeerFund.sol');
const ReindeerToken = artifacts.require('./lib/ReindeerToken.sol');
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
    const precap=300*1800+100;
    const maxcap=precap+(0.4*1500)+(0.4*1500)+(0.8*1500);
    const actualCap = toWei(331); // Complete as the token-cap has been reached, not the contribution volume.
    const actualGoal = toWei(goal);
    const actualMinUserCap = [toWei(crowdsaleParams.minUserCap[0]),toWei(crowdsaleParams.minUserCap[1])];
    const actualMaxUserCap = [toWei(crowdsaleParams.maxUserCap[0]),toWei(crowdsaleParams.maxUserCap[1])];
    const actualMaxTokenSupply = toWei(maxcap);
    const actualPreTokenSupply = toWei(precap);
    const actualInitialFundBalance = toWei(100);
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
    context('--SUCCESS quickly1', ()=> {
      it('Prepare new contracts', async function () {
        const d = 60*60*24;
        const currenttime = web3.eth.getBlock('latest').timestamp + 300*d;
        const goal = 1; //Dummy value for test
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
        await assert.equal(ownership, accounts[0]);
        await obj["token"].transferOwnership(obj["crowdsale"].address).should.be.fulfilled; //change ownership to CloudSale contract
      });
      it('BeforeOpen: Default exchange rate is 1800/eth', async function () {
        const actual = await this.crowdsale.getRate();
        await assert.equal(actual, 1800);
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
        //Not allowed finalize
        await this.crowdsale.finalize({gas:500000}).should.be.rejectedWith(assertThrows);
      });
      it('PreSale: Prepared', async function () {
        const now = web3.eth.getBlock('latest').timestamp;
        const diff = this.presaledAt - now;
        await timeLeap(diff);     
      });
      it('PreSale: Default exchange rate is 1800/eth', async function () {
        const actual = await this.crowdsale.getRate();
        await assert.equal(actual, 1800);
      });
      it('PreSale: Unwhitelisted member can not buy the token.', async function () {
        await this.crowdsale.send(someEther,{from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { from: this.anonymous[0], value: someEther }).should.be.rejectedWith(assertThrows);
      });
      it('PreSale: Whitelisted member allowed under 40000 can not buy the token.', async function () {
        someEther = toWei(0.01);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { from: this.whitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
        someEther = toWei(0.4);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { from: this.whitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
        someEther = toWei(80);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { from: this.whitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
        someEther = toWei(300);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { from: this.whitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
        someEther = toWei(301);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { from: this.whitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
      });
      it('PreSale: Whitelisted member allowed over 40000 can buy the token.', async function () {
	  i=0;
	  i2=0;
          someEther = toWei(0.39);  //under the minUserCap of whitelisted.     
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);
          await this.crowdsale.buyTokens(this.prewhitelisted[i], { from: this.prewhitelisted[i], value: someEther }).should.be.rejectedWith(assertThrows);
          someEther = toWei(0.4);  //minUserCap of whitelisted.  
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);
          await this.crowdsale.buyTokens(this.prewhitelisted[i], { from: this.prewhitelisted[i], value: someEther }).should.be.rejectedWith(assertThrows);
          someEther = toWei(300);  //maxCap of presale.       
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);          
          await this.crowdsale.buyTokens(this.prewhitelisted[i], { from: this.prewhitelisted[i], value: someEther }).should.be.fulfilled;
          someEther = toWei(300);  //The summary of bought volume is under the maxUserCap of prewhitelisted. 
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);
          await this.crowdsale.buyTokens(this.prewhitelisted[i], { from: this.prewhitelisted[i], value: someEther }).should.be.rejectedWith(assertThrows);
          someEther = toWei(300);  //The summary of bought volume is under the maxUserCap of prewhitelisted. 
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);
          await this.crowdsale.buyTokens(this.prewhitelisted[i2], { from: this.prewhitelisted[i], value: someEther }).should.be.rejectedWith(assertThrows);
          const x = await this.crowdsale.getUserContribution(this.prewhitelisted[i]);
          await assert.equal(x, toWei(300)); //Total bought volume is the same as maxUserCap.
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
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.fulfilled;
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;
        someEther=toWei(0.8);
	//Max supply exceeded!
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;
	//Max supply exceeded!
        someEther=toWei(0.1); 
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
      });
      it('Finalize before closed', async function () {
        //Closed
        const actual1 = web3.fromWei(await web3.eth.getBalance(await this.crowdsale.vault()).toNumber(),"ether");
        await assert.notEqual(actual1, 0);
        const actual2 = web3.fromWei(await web3.eth.getBalance(this.fund.address).toNumber(),"ether");
        await assert.equal(actual2, 0);
        //Finalize;
        await this.crowdsale.finalize().should.be.rejectedWith(assertThrows);
        someEther = toWei(0.1);
        await this.crowdsale.buyTokens(this.whitelisted[0], { from: this.whitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
      });
      it('Use fund assets', async function () {
        //Open fund wallet
        
      });     
    })
  })
})
