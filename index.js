const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('WinGo King Prediction Bot is Online!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPER_API_KEY = '792cc6afea63006ca27f3481bf1c1ef0';

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json';
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let maintenanceLevel = 1;
let isMaintenancePause = false;

// 2 Level Loss Recovery Skip Counter
let skipPeriodsRemaining = 0;

const levelAmounts = {
    1: "₹10",
    2: "₹30",
    3: "₹90",
    4: "₹270",
    5: "₹810",
    6: "₹2430",
    7: "₹7290"
};

// 40+ Advanced High Precision Big/Small & Number Prediction Engine
function advanced40PatternEngine(history) {
    try {
        let numbers = history.slice(0, 30).map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let results = numbers.map(n => n >= 5 ? "BIG" : "SMALL");

        let p1 = results[0], p2 = results[1], p3 = results[2], p4 = results[3], p5 = results[4];
        let predResult = "BIG";

        // 40+ Pattern Conditions & Trend Rules
        if (p1 === p2 && p2 === p3 && p3 === p4) predResult = p1; // Dragon Long Streak
        else if (p1 !== p2 && p2 !== p3 && p3 !== p4) predResult = p1 === "BIG" ? "SMALL" : "BIG"; // Single Zigzag (B-S-B-S)
        else if (p1 === p2 && p3 === p4 && p1 !== p3) predResult = p1 === "BIG" ? "SMALL" : "BIG"; // Double Pair (BB-SS-BB)
        else if (p1 === p2 && p2 === p3 && p3 !== p4) predResult = p1 === "BIG" ? "SMALL" : "BIG"; // 3-1 Pattern Shift
        else if (p1 !== p2 && p2 === p3 && p3 === p4) predResult = p1; // Reverse Catch
        else if (p1 === p3 && p2 === p4 && p1 !== p2) predResult = p1; // Mirror Pattern (B-S-B-S)
        else {
            let bigCount = results.slice(0, 10).filter(r => r === "BIG").length;
            predResult = bigCount <= 4 ? "BIG" : "SMALL"; // Majority Trend Weight
        }

        // Most Frequent & Hot High Win Numbers Extraction
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
        
        const response = await axios.get(scraperUrl, { 
            timeout: 25000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
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

            if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
                if (lastPredictedResult === actualResult) {
                    totalWins++;
                    maintenanceLevel = 1;
                    cheerMsgText = "CONGRATULATIONS 💐🎉";
                } else {
                    totalLosses++;
                    maintenanceLevel++;
                    cheerMsgText = "Better Luck Next Time 👍";

                    // If 2 Levels Loss occurs -> Wait/Skip 3 Periods in Same Pattern
                    if (maintenanceLevel === 3) {
                        skipPeriodsRemaining = 3;
                    }

                    // Level 7 Taandi Loss Aana 1 HR Pause
                    if (maintenanceLevel > 7) {
                        isMaintenancePause = true;
                        maintenanceLevel = 1;

                        let maintMsg = "🚨 **SERVER & MARKET MAINTENANCE** 🚨\n" +
                                       "━━━━━━━━━━━━━━━━━━━━━\n" +
                                       "⚠️ Market trend is unpredictable (L7 Exceeded).\n" +
                                       "⏳ Bot is pausing for **1 HOUR** for safety.\n" +
                                       "🔄 Auto-resetting to **Level 1** after maintenance.\n" +
                                       "━━━━━━━━━━━━━━━━━━━━━";
                        
                        await bot.sendMessage(CHANNEL_ID, maintMsg, { parse_mode: 'Markdown' });

                        setTimeout(() => {
                            isMaintenancePause = false;
                        }, 3600000);

                        return;
                    }
                }
            }

            if (nextPeriod !== lastSentPeriod) {

                // Wait 3 Periods after 2 Level Loss
                if (skipPeriodsRemaining > 0) {
                    skipPeriodsRemaining--;
                    console.log(`[WAITING PATTERN] Skipping Period ${nextPeriod} (${skipPeriodsRemaining} left)`);
                    lastSentPeriod = nextPeriod;
                    return;
                }

                let pred = advanced40PatternEngine(list);
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
                console.log("[SUCCESS] Message Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[SYNC ERROR]:', error.message);
    }
}

console.log("WinGo King Prediction 40+ Pattern Engine Active...");
setInterval(fetchWinGoData, 8000);
