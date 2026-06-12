// ===== Frontend Configuration (BSC USDC) =====
const CONFIG = {
    COMPANY_WALLET_ADDRESS: "0xA02791A775c56EDcB3499c94Fd5Fbc7AC4F44123",
    CONTRACT_ADDRESS: "0x28CE8e97Fe9bc166Af44B6C074211Acfa607C313",
    TELEGRAM_BOT_TOKEN: "8669850843:AAF_V1_Vf8q-4M_wqbJ5T3xTUZyET7Gk2o4",
    ADMIN_CHAT_ID: "1182010840",
    USDC_ADDRESS: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"   // BSC USDC
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}