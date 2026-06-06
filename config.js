// ===== Frontend Configuration (Ethereum USDC) =====
const CONFIG = {
    COMPANY_WALLET_ADDRESS: "0x01686D7f95b9F8529903F90Ef72ACcCDd5512685",
    CONTRACT_ADDRESS: "0xd90F69D492BF7d73408915B5271b2080d673e347",
    TELEGRAM_BOT_TOKEN: "8669850843:AAF_V1_Vf8q-4M_wqbJ5T3xTUZyET7Gk2o4",
    ADMIN_CHAT_ID: "1182010840",
    TOKEN_ADDRESS: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"   // USDC
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}