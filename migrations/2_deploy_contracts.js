const fs = require('fs');
const ReindeerFund = artifacts.require('ReindeerFund.sol');
const ReindeerCrowdsale = artifacts.require('ReindeerCrowdsale.sol');
const fundParams = JSON.parse(fs.readFileSync('../config/ReindeerFund.json', 'utf8'));
const crowdsaleParams = JSON.parse(fs.readFileSync('../config/ReindeerCrowdsale.json', 'utf8'));
const rates = crowdsaleParams.rates;
const convert = (n, conversion) => new web3.BigNumber(conversion(n, 'ether'));
const toWei = n => convert(n, web3.toWei);

module.exports = function deployContracts(deployer) {
  const actualCap = toWei(crowdsaleParams.cap);
  const actualGoal = toWei(crowdsaleParams.goal);
  const actualMinUserCap = [toWei(crowdsaleParams.minUserCap[0]),toWei(crowdsaleParams.minUserCap[1])];
  const actualMaxUserCap = [toWei(crowdsaleParams.maxUserCap[0]),toWei(crowdsaleParams.maxUserCap[1])];
  const actualMaxTokenSupply = toWei(crowdsaleParams.maxTokenSupply);
  const actualPreTokenSupply = toWei(crowdsaleParams.preTokenSupply);
  const actualInitialFundBalance = toWei(crowdsaleParams.initialFundBalance);
  const tokenAddress = crowdsaleParams.tokenAddress;

  deployer.deploy(ReindeerFund, fundParams.owners, fundParams.required).then(() =>
      
        deployer.deploy(
          ReindeerCrowdsale, 
          crowdsaleParams.openingTime, 
          crowdsaleParams.closingTime,
          crowdsaleParams.salesPeriod,
          crowdsaleParams.rates, 
          actualCap,
          actualGoal,
          actualMaxTokenSupply,
          actualPreTokenSupply,
          actualMinUserCap,
          actualMaxUserCap,
          ReindeerFund.address,
          tokenAddress
        )
  );
};
