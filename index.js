const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Bot State & Metrics Tracking
let totalPredictions = 0;
let totalWins = 0;
let totalJackpots = 0;
let totalLosses = 0;
let currentLevel = 1;
let maxLevelReached = 1;
let netProfitLoss = 0;

// Batch Data History Storage
let currentBatchHistory = [];
let recentNumbersHistory = [];

// Helper function to send Telegram Message
async function sendTelegramMessage(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error("Telegram Send Error:", error.message);
    }
}

// Function to reset batch stats
function resetBatchStats() {
    totalWins = 0;
    totalJackpots = 0;
    totalLosses = 0;
    maxLevelReached = 1;
    netProfitLoss = 0;
    currentBatchHistory = [];
}

// Strict 2-Number Target Logic
function getExactTwoTargetNumbers(history) {
    if (history.length < 5) return [7, 9];

    const last5 = history.slice(-5);
    const lastNum = history[history.length - 1];
    
    let bigCount = 0;
    let smallCount = 0;

    last5.forEach(num => {
        if (num >= 5) bigCount++; else smallCount++;
    });

    const isBigTrend = bigCount >= smallCount;

    if (isBigTrend) {
        if (lastNum === 5 || lastNum === 0) return [7, 9];
        if (lastNum === 6 || lastNum === 1) return [6, 8];
        if (lastNum === 7 || lastNum === 2) return [7, 9];
        return [5, 8];
    } else {
        if (lastNum === 0 || lastNum === 5) return [1, 3];
        if (lastNum === 1 || lastNum === 6) return [0, 2];
        if (lastNum === 2 || lastNum === 7) return [1, 3];
        return [0, 4];
    }
}

// Webhook Route
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body;
        
        if (!data || !data.period || data.resultNumber === undefined) {
            return res.status(400).send([0, 0]);
        }

        totalPredictions++;
        const currentBatchNumber = totalPredictions;
        const resultNum = parseInt(data.resultNumber);

        recentNumbersHistory.push(resultNum);
        if (recentNumbersHistory.length > 20) recentNumbersHistory.shift();

        // Get ONLY 2 target numbers
        const targetNumbers = getExactTwoTargetNumbers(recentNumbersHistory);

        const isWin = data.isWin || false; 
        const isJackpot = data.isJackpot || false;
        const profitAmount = data.profit || 0;

        if (isWin) {
            totalWins++;
            if (isJackpot) totalJackpots++;
            netProfitLoss += profitAmount;
            currentLevel = 1;
        } else {
            totalLosses++;
            netProfitLoss -= profitAmount;
            currentLevel++;
            if (currentLevel > maxLevelReached) {
                maxLevelReached = currentLevel;
            }
        }

        const roundStatus = isWin ? (isJackpot ? "💥 JACKPOT" : "✅ WIN") : "❌ LOSS";
        currentBatchHistory.push({
            batchIndex: currentBatchNumber,
            period: data.period,
            status: roundStatus,
            level: currentLevel,
            targets: targetNumbers.join(',')
        });

        // Telegram Report at 60, 120, 180...
        if (totalPredictions % 60 === 0) {
            const startRange = totalPredictions - 59;
            const endRange = totalPredictions;

            let reportText = `📊 **BATCH SUMMARY REPORT (${startRange} TO ${endRange})** 📊\n`;
            reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
            reportText += `🎯 **TOTAL PREDICTIONS:** 60\n`;
            reportText += `🏆 **TOTAL WINS:** ${totalWins}\n`;
            reportText += `💥 **TOTAL JACKPOTS:** ${totalJackpots}\n`;
            reportText += `💔 **TOTAL LOSSES:** ${totalLosses}\n`;
            reportText += `📈 **MAX LEVEL REACHED:** Level ${maxLevelReached}\n`;
            reportText += `💰 **NET PROFIT / LOSS:** ${netProfitLoss >= 0 ? '+' : ''}₹${netProfitLoss.toFixed(2)}\n`;
            reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
            reportText += `📝 **FULL BATCH HISTORY (${startRange}-${endRange}):**\n\n`;

            currentBatchHistory.forEach((item) => {
                reportText += `${item.status} | Period: ${item.period} | Targets: [${item.targets}] | Lvl: ${item.level}\n`;
            });

            reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
            reportText += `🔄 Batch ${startRange}-${endRange} Completed!`;

            await sendTelegramMessage(reportText);
            resetBatchStats();
        }

        // Returns ONLY the 2 target numbers (e.g. [7, 9] or [1, 3])
        return res.status(200).json(targetNumbers);

    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(500).json([0, 0]);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
