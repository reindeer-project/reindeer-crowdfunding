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
    context('--OTHERS', ()=> {
      it('Prepare new contracts', async function () {
        const d = 60*60*24;
        const currenttime = web3.eth.getBlock('latest').timestamp + 200*d;
        const goal = 1; //Dummy value for test
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
      it('BeforeOpen: Mint private tokens', async function () {
        await obj["crowdsale"].resetTokenOwnership({ from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        var ownership = await obj["token"].owner();
        //Check the token ownership control
        await obj["crowdsale"].resetTokenOwnership().should.be.fulfilled; //change ownership to CloudSale contract's owner
        var ownership = await obj["token"].owner();
        await obj["token"].mint(this.anonymous[1],toWei(1000000));
        await assert.equal(await this.token.balanceOf(this.anonymous[1]), toWei(1000000));        
        await obj["token"].transferOwnership(obj["crowdsale"].address); //change ownership to CloudSale contract
        await assert.equal(ownership, accounts[0]);
        //Not allowed finalize
        await this.crowdsale.finalize({gas:500000}).should.be.rejectedWith(assertThrows);
      });

      it('BeforeOpen: Default exchange rate is 2000/eth', async function () {
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
      it('BeforeOpen: Whitelisted member allowed under 40000 can not buy the token.', async function () {
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
      it('PreSale: Emergency stop!', async function () {
        await this.crowdsale.pause();
      });
      it('PreSale: During paused state, whitelisted member allowed over 40000 can buy the token.', async function () {
        for (i = 0; i <2; i++){
          someEther = toWei(0.01);  //under the minUserCap of whitelisted.     
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);
          await this.crowdsale.buyTokens(this.prewhitelisted[i], { from: this.prewhitelisted[i], value: someEther }).should.be.rejectedWith(assertThrows);
          someEther = toWei(0.1);  //minUserCap of whitelisted.  
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);
          await this.crowdsale.buyTokens(this.prewhitelisted[i], { from: this.prewhitelisted[i], value: someEther }).should.be.rejectedWith(assertThrows);
          someEther = toWei(80);   //maxUserCap of whitelisted.    
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);
          await this.crowdsale.buyTokens(this.prewhitelisted[i], { from: this.prewhitelisted[i], value: someEther }).should.be.rejectedWith(assertThrows);
          someEther = toWei(2.0);  //minUserCap of prewhitelisted.       
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);          
          await this.crowdsale.buyTokens(this.prewhitelisted[i], { from: this.prewhitelisted[i], value: someEther }).should.be.rejectedWith(assertThrows);
          someEther = toWei(40000);  //maxUserCap of prewhitelisted. 
          await this.crowdsale.send(someEther,{from: this.prewhitelisted[i]}).should.be.rejectedWith(assertThrows);
          await this.crowdsale.buyTokens(this.prewhitelisted[i], { from: this.prewhitelisted[i], value: someEther }).should.be.rejectedWith(assertThrows);
          
          const x = await this.crowdsale.getUserContribution(this.prewhitelisted[i]);
          await assert.equal(x, toWei(0)); //Total bought volume is the same as maxUserCap.
          //Not allowed finalize
          await this.crowdsale.finalize({gas:500000}).should.be.rejectedWith(assertThrows);
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
      it('1stTerm: During emergency paused, the whitelisted member cannot buy the token.', async function () {
        someEther=toWei(0.09); 
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(0.4);
        //const gas1 = await this.crowdsale.buyTokens.estimateGas(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]});
        //console.log(gas1+"unit, " + gas1*0.0000005*80000+"JPY");
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(80);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(40000);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
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
      it('2ndTerm: Restart!', async function () {
        await this.crowdsale.unpause();
      });      
      it('2ndTerm: Only the whitelisted member can buy the token.', async function () {
        someEther=toWei(0.09); 
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(0.4);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.fulfilled;
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;
        someEther=toWei(80);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;
        someEther=toWei(40000);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
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
        someEther=toWei(0.09); 
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(0.4);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.fulfilled;
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;
        someEther=toWei(80);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.fulfilled;
        someEther=toWei(40000);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
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
      it('PreSale: Emergency stop!', async function () {
        await this.crowdsale.pause();
      });
      it('4thTerm: During stop, the whitelisted member cannot buy the token.', async function () {
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
        someEther=toWei(80);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(40000);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
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
        someEther=toWei(80);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
        someEther=toWei(40000);
        await this.crowdsale.send(someEther,{from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.anonymous[0], { value: someEther, from: this.anonymous[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.whitelisted[0], { value: someEther, from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
        await this.crowdsale.buyTokens(this.prewhitelisted[2], { value: someEther, from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
      });
      it('Mint before finalized', async function () {
        await obj["crowdsale"].resetTokenOwnership().should.be.fulfilled; //change ownership to CloudSale contract's owner
        await this.token.mint(this.fund.address,toWei(10000));
        await obj["token"].transferOwnership(obj["crowdsale"].address); //change ownership to CloudSale contract
      });
      it('Not refundable before finalization', async function () {
        //Not refundable
        await this.crowdsale.claimRefund({from: this.whitelisted[0]}).should.be.rejectedWith(assertThrows);
      });
      it('Finalize', async function () {
        //Closed
        const actual1 = web3.fromWei(await web3.eth.getBalance(await this.crowdsale.vault()).toNumber(),"ether");
        await assert.notEqual(actual1, 0);
        const actual2 = web3.fromWei(await web3.eth.getBalance(this.fund.address).toNumber(),"ether");
        await assert.equal(actual2, 0);
        //Finalize
	//console.log(web3.fromWei(await this.token.totalSupply(),"ether"));
	//console.log(web3.fromWei(await this.token.balanceOf(this.fund.address),"ether"));
        await this.crowdsale.finalize({gas:500000}).should.be.fulfilled;
	//Automatically mint upto max token supply. Minted token is sent to fund address.
	//console.log(web3.fromWei(await this.token.totalSupply(),"ether"));
	//console.log(web3.fromWei(await this.token.balanceOf(this.fund.address),"ether"));

        const actual3 = web3.fromWei(await web3.eth.getBalance(await this.crowdsale.vault()).toNumber(),"ether");
        await assert.equal(actual3, 0);
        const actual4 = web3.fromWei(await web3.eth.getBalance(this.fund.address).toNumber(),"ether");
        await assert.notEqual(actual4, 0);
        //Finalize need to be work at once.
        await assert.equal(actual1, actual4); //same eth sent to the wallet.
        //Unrefundable before finalize

        await this.crowdsale.finalize({gas:500000}).should.be.rejectedWith(assertThrows);
      });
      it('Can not buy after finalinzation', async function () {
        someEther = toWei(0.1);
        await this.crowdsale.buyTokens(this.whitelisted[0], { from: this.whitelisted[0], value: someEther }).should.be.rejectedWith(assertThrows);
      });     
      it('Not refundable after finalinzation', async function () {
        await this.crowdsale.claimRefund({from: this.prewhitelisted[2]}).should.be.rejectedWith(assertThrows);
      });
      it('Burn after finalized', async function () {
        //Move burnable amount of token to owner account.
        const total1 = await this.token.totalSupply();
        const fund1 = await this.token.balanceOf(this.fund.address);
        const sold1  = total1 - fund1;
        const burnable = fund1 - sold1;
        //Reset ownership
        await obj["crowdsale"].resetTokenOwnership().should.be.fulfilled;
        //Transfer ownership
        await obj["token"].transferOwnership(obj["fund"].address).should.be.fulfilled;

        //burn
        const transferEncoded = await this.token.contract.burn.getData(burnable);
        const transaction = await this.fund.submitTransaction(this.token.address, 0, transferEncoded, {from: this.fundOwners[0]});
        const log = transaction.logs.filter((l) => l.event === "Submission");
        const pm = log[0].args["transactionId"];
        //Need just one more owner's confirmation. (sender and additional one person can execute the transaction)
        const confirmA = await this.fund.confirmTransaction(pm,{from: this.fundOwners[1]}).should.be.fulfilled;
        const totalTkn = await this.token.totalSupply();
        const fundTkn = await this.token.balanceOf(this.fund.address);
        const percentage1 = fundTkn / totalTkn;
        const percentage2 = Math.floor(percentage1*100);

        await assert.isAbove(percentage2, 49); //Fund own nearly 50% of total supply.  

      });
      it('Sned token', async function () {        
        //sendToken
        const sometoken = toWei(10);
        const ownertoken2 = await this.token.balanceOf(this.fundOwners[1]);
        const transferEncoded1 = await this.token.contract.transfer.getData(this.fundOwners[1],sometoken);
        const transaction1 = await this.fund.submitTransaction(this.token.address, 0, transferEncoded1, {from: this.fundOwners[0]});
        const log1 = transaction1.logs.filter((l) => l.event === "Submission");
        const pm1 = log1[0].args["transactionId"];
        //Need just one more owner's confirmation. (sender and additional one person can execute the transaction)
        const confirmB = await this.fund.confirmTransaction(pm1,{from: this.fundOwners[1]}).should.be.fulfilled;
        const ownertoken3 = await this.token.balanceOf(this.fundOwners[1]);
        const ownertoken4 = ownertoken2 + sometoken;
        await assert.equal(ownertoken3.toNumber(), ownertoken4);
      });
      it('Mint after finalized', async function () {
        const fundA = await this.token.balanceOf(this.fund.address);
        const total3 = await this.token.totalSupply();
        const mintbalance = total3*0.1/12;
        const transferEncoded2 = await this.token.contract.mint.getData(obj["fund"].address,mintbalance);
        const transaction2 = await this.fund.submitTransaction(this.token.address, 0, transferEncoded2, {from: this.fundOwners[0]});
        const log2 = transaction2.logs.filter((l) => l.event === "Submission");
        const pm2 = log2[0].args["transactionId"];
        //Need just one more owner's confirmation. (sender and additional one person can execute the transaction)
        const confirmC = await this.fund.confirmTransaction(pm2,{from: this.fundOwners[1]}).should.be.fulfilled;
        const fundB = await this.token.balanceOf(this.fund.address);
        const total4 = await this.token.totalSupply();
        await assert.isAbove(total4.toNumber(),total3.toNumber());
        await assert.isAbove(fundB.toNumber(),fundA.toNumber());
        //console.log(total3+" << "+total4);
        //console.log(fundA+" << "+fundB);
      });
      it('Withdraw ether from the fund', async function () {
        const actual3 = web3.fromWei(await web3.eth.getBalance(this.fundOwners[2]).toNumber(),"ether");
        const transaction3 = await this.fund.submitTransaction(this.fundOwners[2], web3.toWei(1), "", {from: this.fundOwners[0]});
        const log3 = transaction3.logs.filter((l) => l.event === "Submission");
        const pm3 = log3[0].args["transactionId"];
        //Need just one more owner's confirmation. (sender and additional one person can execute the transaction)
        const confirmD = await this.fund.confirmTransaction(pm3,{from: this.fundOwners[1]}).should.be.fulfilled;
        const actual4 = web3.fromWei(await web3.eth.getBalance(this.fundOwners[2]).toNumber(),"ether");
        await assert.isAbove(actual4,actual3);
      });
      it('Transfer token ownership for other contracts.', async function () {
        const transferEncoded5 = await this.token.contract.transferOwnership.getData(this.fundOwners[0]);
        const transaction5 = await this.fund.submitTransaction(this.token.address, 0, transferEncoded5, {from: this.fundOwners[0]});
        const log5 = transaction5.logs.filter((l) => l.event === "Submission");
        const pm5 = log5[0].args["transactionId"];
        //Need just one more owner's confirmation. (sender and additional one person can execute the transaction)
        const confirmD = await this.fund.confirmTransaction(pm5,{from: this.fundOwners[1]}).should.be.fulfilled;
        const ownershipD = await this.token.owner();
        await assert.equal(ownershipD,this.fundOwners[0]);
      });
    })
  })
})
