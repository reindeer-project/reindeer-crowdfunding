pragma solidity ^0.4.19;

import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol';
import 'zeppelin-solidity/contracts/crowdsale/distribution/utils/RefundVault.sol';
import 'zeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol';
import 'zeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol';
import 'zeppelin-solidity/contracts/token/ERC20/MintableToken.sol';
import 'zeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol';
import 'zeppelin-solidity/contracts/lifecycle/Pausable.sol';
import 'zeppelin-solidity/contracts/crowdsale/validation/IndividuallyCappedCrowdsale.sol';


contract ReindeerCrowdsale is CappedCrowdsale, IndividuallyCappedCrowdsale, 
RefundableCrowdsale, MintedCrowdsale, WhitelistedCrowdsale, Pausable {
    using SafeMath for uint256;
    uint256[] private rates;
    uint256[] private salesPeriod;
    uint256 private closingTime;
    uint256 private cap;
    uint256 private maxTokenSupply;
    uint256 private preTokenSupply;
    uint256[] private minUserCap;
    uint256[] private maxUserCap;
    address private fund;
    MintableToken private token;
    address[] private preWhitelist;

    // Token
    /**
     *  @notice Constructor
     *  @param _openingTime The time the Crowdsale starts.
     *  @param _closingTime The time the Crowdsale ends.
     *  @param _salesPeriod The time after presale has been finished.
     *  @param _rates  The number of `wei` needed to buy one token.
     *  @param _cap  The maximum amount of ether to be raised.
     *  @param _goal The minimum amout of ether to be raised for the
     *               Crowdsale to allow distribution of tokens.
     *  @param _maxTokenSupply The maximum amount of reindeerToken to be supplied.
     *  @param _preTokenSupply The maximum amount of reindeerToken to be supplied for presale.
     *  @param _minUserCap The minimum amount of token to be raised per user.
     *  @param _maxUserCap The maximum amount of token to be raised per user.
     *  @param _fund The address to be used to hold the `wei` being deposited to buy tokens.
     *  @param _token The MintableToken to be bought.
     */
    function ReindeerCrowdsale(
        uint256 _openingTime, 
        uint256 _closingTime, 
        uint256[] _salesPeriod,
        uint256[] _rates, 
        uint256 _cap,
        uint256 _goal,
        uint256 _maxTokenSupply,
        uint256 _preTokenSupply,
        uint256[] _minUserCap,
        uint256[] _maxUserCap,
        address _fund,
        MintableToken _token
    )
        public
        Crowdsale(_rates[0], _fund, _token)
        CappedCrowdsale(_cap)
        IndividuallyCappedCrowdsale()
        TimedCrowdsale(_openingTime, _closingTime)
        RefundableCrowdsale(_goal)
        WhitelistedCrowdsale()
    {
        require(_goal <= _cap);
        rates = _rates;
        cap = _cap;
        maxTokenSupply = _maxTokenSupply;
        preTokenSupply = _preTokenSupply;
        minUserCap = _minUserCap;
        maxUserCap = _maxUserCap;
        salesPeriod = _salesPeriod;
        closingTime = _closingTime;
        token = _token;
        fund = _fund;
    }

    /**
     *  Return current selling ratio.
     *  @return _currentRate current selling ratio.
     */
    function getRate()
        public
        constant 
        returns (uint256) 
    {
        uint256 _now = block.timestamp;
        uint _term = _salesTerm(_now);
        uint256 _currentRate = rates[_term];
        return _currentRate;
    }

    /**
     * reset ownership
    *  @return owner New owner of token
     */
    function resetTokenOwnership() 
        public onlyOwner
        returns (address)
    {
        require(msg.sender == owner); // Only the owner of the crowdsale contract should be able to call this function.
        // I assume the crowdsale contract holds a reference to the token contract.
        token.transferOwnership(owner);
        return owner;
    }

    /**
     *  Overrides `RefundableCrowdsale` finalization task,
     *  called when owner calls `finalize()`
     */
    function finalization()
        internal
    {
        uint256 remaining = maxTokenSupply.sub(token.totalSupply());
        if (remaining > 0) {
            token.mint(fund, remaining);
        }
        super.finalization();
    }

    /**
     *  Calcurate the token amount to be exchanged.
     *  @param _weiAmount Value in wei to be converted into tokens
     *  @return the whole number of tokens that can be purchased with the specified _weiAmount
     */
    function _getTokenAmount(uint256 _weiAmount)
        internal
        view
        returns (uint256)
    {
        return uint256(_weiAmount.mul(getRate()));
    }

    /**
     * @param _beneficiary Token purchaser
     * @param _weiAmount Amount of wei contributed
     */
    function _preValidatePurchase(address _beneficiary, uint256 _weiAmount)
        internal
    {
        require(!paused);
        require(_beneficiary != address(0));
        require(_weiAmount != 0);

        require(weiRaised.add(_weiAmount) <= cap);
        require(_isContributable(_beneficiary, _weiAmount));
        super._preValidatePurchase(_beneficiary, _weiAmount);
    }

    /**
     * @param _beneficiary Token purchaser.
     * @param _weiAmount Token amount.
     */
    function _isContributable(address _beneficiary, uint256 _weiAmount)
        internal
        returns (bool) 
    {
        uint256 _now = block.timestamp;
        uint _term = _salesTerm(_now);

        if (_term == 0) {
            //Pre sale
            if (getUserCap(_beneficiary) >= maxUserCap[1] 
            && _weiAmount >= minUserCap[1]
            && getUserContribution(_beneficiary).add(_weiAmount) <= getUserCap(_beneficiary)
            && token.totalSupply().add(_getTokenAmount(_weiAmount)) <= preTokenSupply
            ) {
                return true;
            } else {
                return false;
            }
        } else {
            if (getUserCap(_beneficiary) >= maxUserCap[0]
            && _weiAmount >= minUserCap[0]
            && getUserContribution(_beneficiary).add(_weiAmount) <= getUserCap(_beneficiary)
            && token.totalSupply().add(_getTokenAmount(_weiAmount)) <= maxTokenSupply
            ) {
                return true;
            } else {
                return false;
            }
        }
    }

    /**
     * @param _now time
     */
    function _salesTerm(uint256 _now)
        internal
        returns (uint) 
    {
        if (_now < salesPeriod[0]) {
            //Pre
            return 0;
        } else if (_now < salesPeriod[1]) {
            //1st
            return 1;
        } else if (_now < salesPeriod[2]) {
            //2nd
            return 2;
        } else if (_now < salesPeriod[3]) {
            //3rd
            return 3;
        } else if (_now < closingTime) {
            //4th
            return 4;
        }else {
            return 4;
        }
    }
}
