pragma solidity ^0.4.19;


import 'zeppelin-solidity/contracts/token/ERC20/MintableToken.sol';
import 'zeppelin-solidity/contracts/token/ERC20/BurnableToken.sol';


contract ReindeerToken is MintableToken, BurnableToken {

    string public constant name = 'reindeer token';

    string public constant symbol = 'RDT';

    uint public constant decimals = 18;
}