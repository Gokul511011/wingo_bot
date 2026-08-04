const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('WinGo King Prediction Bot Active!'));
app.listen(PORT, () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPER_API_KEY = 'f12c59abca9948a7cc85a14de5a93719';

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json';
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let maintenanceLevel = 1;
let consecutiveLosses = 0;
let winStreak = 0; // Track Continuous Wins

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

// Advanced Deep Analysis Engine
function advancedPredictionEngine(history) {
    try {
        let numbers = history.slice(0, 30).map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let results = numbers.map(n => n >= 5 ? "BIG" : "SMALL");

        let bigCount = results.slice(0, 10).filter(r => r === "BIG").length;

        let predResult = "BIG";

        // Strategy 1: Streak Continuation (Dragon Trend)
        if (results[0] === results[1] && results[1] === results[2]) {
            predResult = results[0]; 
        } 
        // Strategy 2: Single Alternating Trend (B-S-B-S)
        else if (results[0] !== results[1] && results[1] !== results[2] && results[2] !== results[3]) {
            predResult = results[0] === "BIG" ? "SMALL" : "BIG";
        } 
        // Strategy 3: Weighted Reversion
        else {
            predResult = bigCount <= 4 ? "BIG" : "SMALL";
        }

        // Deep Number Frequency Analysis
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
        console.error("Prediction Engine Error:", e.message);
        return { predResult: "BIG", numbersStr: "7, 8", colorStr: "🟢 GREEN" };
    }
}

async function fetchWinGoData() {
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

            let cheerMsgText = "";

            // Win / Loss Verification
            if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
                if (lastPredictedResult === actualResult) {
                    totalWins++;
                    winStreak++;
                    consecutiveLosses = 0;
                    maintenanceLevel = 1; // Reset Level
                    cheerMsgText = "🎉 super mame... 🔥";

                    // 7 Continuous Wins Special Alert!
                    if (winStreak === 7) {
                        let win7Alert = "🎉🔥 **SUPER MAME 7 CONTINUOUS WINS!** 🔥🎉\n" +
                                        "━━━━━━━━━━━━━━━━━━━━━\n" +
                                        "👑 King Prediction Bot Hit 7 Wins in a Row!\n" +
                                        "💪 Keep Profiting, Mame!\n" +
                                        "━━━━━━━━━━━━━━━━━━━━━";
                        await bot.sendMessage(CHANNEL_ID, win7Alert, { parse_mode: 'Markdown' });
                        winStreak = 0; // Reset after alert
                    }
                } else {
                    totalLosses++;
                    winStreak = 0; // Reset Win Streak
                    consecutiveLosses++;
                    maintenanceLevel++;
                    cheerMsgText = "💪 vidu mame next time pakkalam...";

                    // Rule: Level > 7 Maintenance Mode (1 Hour Pause)
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
                            console.log("[SYSTEM]: 1 Hour Pause Completed.");
                        }, 3600000);

                        return;
                    }

                    // Rule: 2 Consecutive Losses (1 Min Cooldown Pause)
                    if (consecutiveLosses >= 2) {
                        isCoolingDown = true;
                        consecutiveLosses = 0;

                        let coolMsg = "⏳ **MARKET TREND PAUSE (1 MIN)** ⏳\n" +
                                      "━━━━━━━━━━━━━━━━━━━━━\n" +
                                      "⚠️ 2 Continuous Losses Detected!\n" +
                                      "🛑 Pausing 1 Minute for safer trend match...\n" +
                                      "━━━━━━━━━━━━━━━━━━━━━";

                        await bot.sendMessage(CHANNEL_ID, coolMsg, { parse_mode: 'Markdown' });

                        setTimeout(() => {
                            isCoolingDown = false;
                            console.log("[SYSTEM]: 1 Min Cooldown Completed.");
                        }, 60000);

                        return;
                    }
                }
            }

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
                          "━━━━━━━━━━━━━━━━━━━━━\n";

                if (cheerMsgText !== "") {
                    msg += cheerMsgText + "\n━━━━━━━━━━━━━━━━━━━━━\n";
                }

                msg += "\n🏆 **TOTAL WINS:** **" + totalWins + "**\n" +
                       "💔 **TOTAL LOSS:** **" + totalLosses + "**\n\n" +
                       "🔗 **Register Link:**\n" + REGISTER_LINK;

                await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });

                lastSentPeriod = nextPeriod;
                lastPredictedPeriod = nextPeriod;
                lastPredictedResult = pred.predResult;
                console.log("[SUCCESS] Update Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[SYNC ERROR]:', error.message);
    }
}

console.log("WinGo King Prediction Active...");
setInterval(fetchWinGoData, 8000);
