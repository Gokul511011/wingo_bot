const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('WinGo Pro Engine Bot Active!'));
app.listen(PORT, () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPER_API_KEY = 'f12c59abca9948a7cc85a14de5a93719';

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let maintenanceLevel = 1;
let consecutiveLosses = 0;

// Pause Timers
let isCoolingDown = false; // 1 Min Pause
let isMaintenancePause = false; // 1 Hour Pause

// Martingale Level Amounts
const levelAmounts = {
    1: "₹10",
    2: "₹30",
    3: "₹90",
    4: "₹270",
    5: "₹810",
    6: "₹2430",
    7: "₹7290"
};

// Advanced Prediction Engine
function advancedPredictionEngine(history) {
    try {
        let numbers = history.slice(0, 30).map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let results = numbers.map(n => n >= 5 ? "BIG" : "SMALL");

        let bigCount = results.slice(0, 10).filter(r => r === "BIG").length;
        let smallCount = 10 - bigCount;

        let predResult = "BIG";

        // Pattern 1: Dragon / Streak (3+ continuous same result)
        if (results[0] === results[1] && results[1] === results[2]) {
            predResult = results[0]; 
        } 
        // Pattern 2: Single Zig-Zag / Alternate Pattern (B-S-B-S)
        else if (results[0] !== results[1] && results[1] !== results[2] && results[2] !== results[3]) {
            predResult = results[0] === "BIG" ? "SMALL" : "BIG";
        } 
        // Pattern 3: Weighted Reversion
        else {
            predResult = bigCount <= 4 ? "BIG" : "SMALL";
        }

        // Smart 2-Number Selection Logic based on recent frequency
        let targetNumbers = [];
        if (predResult === "BIG") {
            let bigNums = [5, 6, 7, 8, 9];
            let recentBigs = numbers.filter(n => n >= 5);
            let freqMap = {};
            recentBigs.forEach(n => freqMap[n] = (freqMap[n] || 0) + 1);
            bigNums.sort((a, b) => (freqMap[b] || 0) - (freqMap[a] || 0));
            targetNumbers = [bigNums[0], bigNums[1]];
        } else {
            let smallNums = [0, 1, 2, 3, 4];
            let recentSmalls = numbers.filter(n => n < 5);
            let freqMap = {};
            recentSmalls.forEach(n => freqMap[n] = (freqMap[n] || 0) + 1);
            smallNums.sort((a, b) => (freqMap[b] || 0) - (freqMap[a] || 0));
            targetNumbers = [smallNums[0], smallNums[1]];
        }

        let numbersStr = targetNumbers.join(", ");
        let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";

        return { predResult, numbersStr, colorStr };
    } catch (e) {
        console.error("Prediction Logic Error:", e.message);
        return { predResult: "BIG", numbersStr: "7, 8", colorStr: "🟢 GREEN" };
    }
}

async function fetchWinGoData() {
    // If in 1 Hour Maintenance Mode, skip processing
    if (isMaintenancePause) return;

    try {
        const scraperUrl = "http://api.scraperapi.com?api_key=" + SCRAPER_API_KEY + "&url=" + encodeURIComponent(TARGET_URL);
        
        const response = await axios.get(scraperUrl, { timeout: 25000 });
        let data = response.data;

        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) {}
        }

        let list = data?.data?.list || data?.list || data;

        if (Array.isArray(list) && list.length > 0) {
            let lastItem = list[0];
            let actualNum = parseInt(lastItem.number !== undefined ? lastItem.number : lastItem.result);
            let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
            let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue);
            
            let nextPeriod = String(BigInt(actualPeriod) + 1n);

            // Win / Loss Verification Logic
            if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
                if (lastPredictedResult === actualResult) {
                    totalWins++;
                    consecutiveLosses = 0;
                    maintenanceLevel = 1; // Reset to L1 on Win
                } else {
                    totalLosses++;
                    consecutiveLosses++;
                    maintenanceLevel++;

                    // Rule 1: Level > 7 Trigger Maintenance Mode (1 Hour Pause)
                    if (maintenanceLevel > 7) {
                        isMaintenancePause = true;
                        maintenanceLevel = 1;
                        consecutiveLosses = 0;

                        let maintMsg = "🚨 **SERVER & MARKET MAINTENANCE** 🚨\n" +
                                       "━━━━━━━━━━━━━━━━━━━━━\n" +
                                       "⚠️ Market trend is unpredictable (L7 Exceeded).\n" +
                                       "⏳ Bot is pausing for **1 HOUR** for safety.\n" +
                                       "🔄 Auto-resetting to **Level 1** after maintenance.\n" +
                                       "━━━━━━━━━━━━━━━━━━━━━";
                        
                        await bot.sendMessage(CHANNEL_ID, maintMsg, { parse_mode: 'Markdown' });

                        setTimeout(() => {
                            isMaintenancePause = false;
                            console.log("[SYSTEM]: 1 Hour Maintenance Pause Ended. Bot Resumed.");
                        }, 3600000); // 1 Hour

                        return;
                    }

                    // Rule 2: Continuous 2 Losses Trigger 1 Min Cooldown Pause
                    if (consecutiveLosses >= 2) {
                        isCoolingDown = true;
                        consecutiveLosses = 0; // Reset counter for cooldown

                        let coolMsg = "⏳ **MARKET TREND PAUSE (1 MIN)** ⏳\n" +
                                      "━━━━━━━━━━━━━━━━━━━━━\n" +
                                      "⚠️ 2 Continuous Losses Detected!\n" +
                                      "🛑 Pausing 1 Minute for safer trend match...\n" +
                                      "━━━━━━━━━━━━━━━━━━━━━";

                        await bot.sendMessage(CHANNEL_ID, coolMsg, { parse_mode: 'Markdown' });

                        setTimeout(() => {
                            isCoolingDown = false;
                            console.log("[SYSTEM]: 1 Min Cooldown Completed. Resuming.");
                        }, 60000); // 60 Seconds

                        return;
                    }
                }
            }

            // If cooling down, skip sending next prediction
            if (isCoolingDown) return;

            if (nextPeriod !== lastSentPeriod) {
                let pred = advancedPredictionEngine(list);
                let currentAmount = levelAmounts[maintenanceLevel] || ("Level " + maintenanceLevel);

                let msg = "👑 **KING PREDICTION**\n" +
                          "━━━━━━━━━━━━━━━━━━━━━\n" +
                          "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                          "🎯 **TARGET:** **" + pred.predResult + "**\n" +
                          "🔢 **NUMBERS:** `" + pred.numbersStr + "`\n" +
                          "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                          "💰 **LEVEL AMOUNT:** **Level " + maintenanceLevel + " (" + currentAmount + ")**\n" +
                          "━━━━━━━━━━━━━━━━━━━━━\n\n" +
                          "🏆 **TOTAL WINS:** **" + totalWins + "**\n" +
                          "💔 **TOTAL LOSS:** **" + totalLosses + "**";

                await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });

                lastSentPeriod = nextPeriod;
                lastPredictedPeriod = nextPeriod;
                lastPredictedResult = pred.predResult;
                console.log("[SUCCESS] Pro Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[SYNC ERROR]:', error.message);
    }
}

console.log("WinGo King Pro Bot Active...");
setInterval(fetchWinGoData, 8000);
