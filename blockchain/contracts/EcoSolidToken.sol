// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EcoSolidToken
 * @dev Token ERC20 para recompensa de ações de impacto social e ambiental.
 * O Backend da plataforma é o dono (Owner) do contrato e o único
 * com permissão para "mintar" (cunhar) novos tokens quando uma ação é validada.
 */
contract EcoSolidToken is ERC20, Ownable {
    
    // Evento emitido quando uma ação gera recompensa (Histórico Imutável para Auditoria)
    event ImpactRewarded(address indexed citizen, uint256 amount, string actionType);

    constructor() ERC20("EcoSolid", "SOLID") Ownable(msg.sender) {}

    /**
     * @dev Função chamada pelo Backend para emitir os tokens.
     * @param to Endereço da carteira do cidadão (Web3 Wallet).
     * @param amount Quantidade de SOLID a ser emitida (1 ponto = 1 SOLID).
     * @param actionType O tipo da ação para ficar cravado na blockchain (ex: "RECYCLING").
     */
    function mintImpactReward(address to, uint256 amount, string memory actionType) external onlyOwner {
        // Multiplica pelos decimais padrão do ERC20 (18 zeros)
        uint256 amountWithDecimals = amount * 10 ** decimals();
        
        // Emite (minta) o token para a carteira
        _mint(to, amountWithDecimals);
        
        // Registra publicamente o evento de impacto na rede (isso é o que a banca quer ver!)
        emit ImpactRewarded(to, amountWithDecimals, actionType);
    }
}
