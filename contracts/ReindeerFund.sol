pragma solidity ^0.4.19;


import './lib/MultiSigWallet.sol';


/**
 * The Multisignature wallet contract of reindeer.
*/
contract ReindeerFund is MultiSigWallet {


    function ReindeerFund(address[] _owners, uint _required)
        public
        validRequirement(_owners.length, _required)
        MultiSigWallet(_owners, _required)
    {
    }

}
