const SECONDS_IN_A_DAY = 60 * 60 * 24

const timeTravel = async thresholdsec => {
  const fs = require('fs');
  const crowdsaleParams = JSON.parse(fs.readFileSync('./config/ReindeerCrowdsale.json', 'utf8'));
  const now = web3.eth.getBlock('latest').timestamp;
  const diffsec = crowdsaleParams.openingTime + thresholdsec - now;
  await web3.currentProvider.send({
    jsonrpc: "2.0", 
    method: "evm_increaseTime", 
    params: [Math.abs(diffsec)], 
    id: new Date().getSeconds()
  })
  await web3.currentProvider.send({
    jsonrpc: '2.0', 
    method: 'evm_mine', 
    params: [], 
    id: new Date().getSeconds()+1
  })
}
const timeLeap = async thresholdsec => {
  const fs = require('fs');
  const now = web3.eth.getBlock('latest').timestamp;
  const leaprange = thresholdsec;
  await web3.currentProvider.send({
    jsonrpc: "2.0", 
    method: "evm_increaseTime", 
    params: [Math.abs(leaprange)], 
    id: new Date().getSeconds()
  })
  await web3.currentProvider.send({
    jsonrpc: '2.0', 
    method: 'evm_mine', 
    params: [], 
    id: new Date().getSeconds()+1
  })
}

const convert = (n, conversion) => new web3.BigNumber(conversion(n, 'ether'))
const toWei = n => convert(n, web3.toWei)/100  //Convert to 1/100 for enable limited testenv.
const fromWei = n => convert(n, web3.fromWei)
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber');
const BigNumber = web3.BigNumber;
const should = chai.use(chaiAsPromised).use(chaiBigNumber(BigNumber)).should();

module.exports = {
  SECONDS_IN_A_DAY,
  timeTravel,
  toWei,
  fromWei,
  should,
  BigNumber,
  timeLeap
}

