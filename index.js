const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Direct Credentials Setup
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-1002486828817";

// Bot Metrics & Tracking
let totalPredictions = 0;
let totalWins = 0;
let totalJackpots = 0;
let totalLosses = 0;
let currentLevel = 1;
let maxLevelReached = 1;
let netProfitLoss = 0;

let currentBatchHistory = [];
let recentNumbersHistory = [];

// Send Telegram Message Helper
async function sendTelegramMessage(message) {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });
        console.log("✅ Telegram Message Sent Successfully!");
    } catch (error) {
        console.error("❌ Telegram Send Error:", error.message);
    }
}

// Reset Stats for Every 60 Batch
function resetBatchStats() {
    totalWins = 0;
    totalJackpots = 0;
    totalLosses = 0;
    maxLevelReached = 1;
    netProfitLoss = 0;
    currentBatchHistory = [];
}

// Prediction Logic: Calculates Big/Small Trend + Exact 2 Target Numbers
function getTrendAndTwoTargets(history) {
    if (history.length < 5) {
        return { trend: "BIG", targets: [7, 9] };
    }

    const last5 = history.slice(-5);
    const lastNum = history[history.length - 1];
    
    let bigCount = 0;
    let smallCount = 0;

    last5.forEach(num => {
        if (num >= 5) bigCount++; else smallCount++;
    });

    const isBigTrend = bigCount >= smallCount;
    const predictedTrend = isBigTrend ? "BIG" : "SMALL";
    let targetNumbers = [];

    if (isBigTrend) {
        if (lastNum === 5 || lastNum === 0) targetNumbers = [7, 9];
        else if (lastNum === 6 || lastNum === 1) targetNumbers = [6, 8];
        else if (lastNum === 7 || lastNum === 2) targetNumbers = [7, 9];
        else targetNumbers = [5, 8];
    } else {
        if (lastNum === 0 || lastNum === 5) targetNumbers = [1, 3];
        else if (lastNum === 1 || lastNum === 6) targetNumbers = [0, 2];
        else if (lastNum === 2 || lastNum === 7) targetNumbers = [1, 3];
        else targetNumbers = [0, 4];
    }

    return { trend: predictedTrend, targets: targetNumbers };
}

// Webhook Route
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body || {};
        
        const period = data.period || data.issue || data.stage || Date.now();
        const rawResult = data.resultNumber !== undefined ? data.resultNumber : (data.number !== undefined ? data.number : data.result);
        const resultNum = parseInt(rawResult) || 0;

        totalPredictions++;
        const currentBatchNumber = totalPredictions;

        recentNumbersHistory.push(resultNum);
        if (recentNumbersHistory.length > 20) recentNumbersHistory.shift();

        // Get Both Big/Small Trend and 2 Target Numbers
        const prediction = getTrendAndTwoTargets(recentNumbersHistory);

        const isWin = data.isWin || false; 
        const isJackpot = data.isJackpot || false;
        const profitAmount = parseFloat(data.profit) || 0;

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
        
        // Record details for batch report
        currentBatchHistory.push({
            batchIndex: currentBatchNumber,
            period: period,
            status: roundStatus,
            level: currentLevel,
            trend: prediction.trend,
            targets: prediction.targets.join(',')
        });

        // Send Telegram Report ONLY at 60, 120, 180...
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
                reportText += `${item.status} | Period: ${item.period} | Trend: ${item.trend} [${item.targets}] | Lvl: ${item.level}\n`;
            });

            reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
            reportText += `🔄 Batch ${startRange}-${endRange} Completed!`;

            await sendTelegramMessage(reportText);
            resetBatchStats();
        }

        // Return Output containing Trend and 2 Target Numbers
        return res.status(200).json({
            trend: prediction.trend,
            targetNumbers: prediction.targets
        });

    } catch (error) {
        console.error("❌ Webhook Error:", error);
        return res.status(500).json({
            trend: "BIG",
            targetNumbers: [7, 9]
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    await sendTelegramMessage("🚀 **Bot Server Live & Connected Successfully!**");
});
