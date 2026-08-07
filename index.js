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

// Batch Data History Storage (Stores full details of 60 rounds)
let currentBatchHistory = [];

// Helper function to send message to Telegram
async function sendTelegramMessage(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.log("Telegram credentials missing.");
        return;
    }
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error("Error sending Telegram message:", error.message);
    }
}

// Function to reset batch stats after reporting
function resetBatchStats() {
    totalWins = 0;
    totalJackpots = 0;
    totalLosses = 0;
    maxLevelReached = 1;
    netProfitLoss = 0;
    currentBatchHistory = [];
}

// Route to process WinGo 30S Data and Predictions
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body;
        
        // Ensure valid input payload
        if (!data || !data.period || data.resultNumber === undefined) {
            return res.status(400).send({ status: 'Invalid Data' });
        }

        totalPredictions++;
        const currentBatchNumber = totalPredictions;

        // Prediction Logic (Existing Winning Patterns + Cold Recoveries)
        const isWin = data.isWin || false; 
        const isJackpot = data.isJackpot || false;
        const profitAmount = data.profit || 0;

        // Level Tracking
        if (isWin) {
            totalWins++;
            if (isJackpot) totalJackpots++;
            netProfitLoss += profitAmount;
            currentLevel = 1; // Reset Level on Win
        } else {
            totalLosses++;
            netProfitLoss -= profitAmount;
            currentLevel++;
            if (currentLevel > maxLevelReached) {
                maxLevelReached = currentLevel;
            }
        }

        // Record individual round details for the full 1-60 batch
        const roundStatus = isWin ? (isJackpot ? "💥 JACKPOT" : "✅ WIN") : "❌ LOSS";
        currentBatchHistory.push({
            batchIndex: currentBatchNumber,
            period: data.period,
            status: roundStatus,
            level: currentLevel
        });

        // Trigger report only at Multiples of 60 (60, 120, 180, etc.)
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

            // Append all 60 predictions history
            currentBatchHistory.forEach((item) => {
                reportText += `${item.status} | Period: ${item.period} | Level: ${item.level}\n`;
            });

            reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
            reportText += `🔄 Batch ${startRange}-${endRange} Completed! Stats reset for next batch.`;

            // Send Telegram summary report
            await sendTelegramMessage(reportText);

            // Reset stats for the next 60 batch
            resetBatchStats();
        }

        res.status(200).send({ status: 'Success', currentPrediction: totalPredictions });

    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).send({ status: 'Error', message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
