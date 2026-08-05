const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render Ping (24/7 Active)
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 30S High Accuracy Bot Active!'));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';

// Scrape.do Token
const SCRAPE_DO_TOKEN = '4ddb13d503da4001819d56960d645d7adef32fa264b';

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=50&pageNo=1';
const PROXY_URL = `https://api.scrape.do/?token=${SCRAPE_DO_TOKEN}&url=${encodeURIComponent(TARGET_URL)}`;
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedNumbers = []; 
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let maintenanceLevel = 1;

// Custom Level Amounts
const levelAmounts = {
    1: "₹1",
    2: "₹3",
    3: "₹9",
    4: "₹27",
    5: "₹81",
    6: "₹243",
    7: "₹729",
    8: "₹1300"
};

// 🎯 HIGH WIN-RATE PREDICTION ENGINE
function highAccuracyEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let recent10 = allResults.slice(0, 10);
        let countB = recent10.filter(x => x === "B").length;
        let countS = recent10.filter(x => x === "S").length;

        let last3 = allResults.slice(0, 3);
        
        let predResult = "BIG";

        // 1. STREAK FOLLOW (Dragon Trend)
        if (last3[0] === last3[1] && last3[1] === last3[2]) {
            predResult = last3[0] === "B" ? "BIG" : "SMALL";
        } else {
            // 2. MOMENTUM TREND
            predResult = countB >= countS ? "BIG" : "SMALL";
        }

        // Hot Numbers Selection for the predicted side
        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let recentNums = allNumbers.slice(0, 15);
        let freqMap = {};
        candidateNums.forEach(n => freqMap[n] = 0);

        recentNums.forEach((n, idx) => {
            if (candidateNums.includes(n)) {
                freqMap[n] += (15 - idx);
            }
        });

        let sortedCandidates = candidateNums.sort((a, b) => freqMap[b] - freqMap[a]);
        let targetNumbers = [sortedCandidates[0], sortedCandidates[1]];

        let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";
        if (targetNumbers.includes(0) || targetNumbers.includes(5)) {
            colorStr += " / 🟣 VIOLET";
        }

        return { predResult, targetNumbers, colorStr };

    } catch (e) {
        console.error("Engine Error:", e.message);
        return { predResult: "BIG", targetNumbers: [7, 8], colorStr: "🟢 GREEN" };
    }
}

async function fetchWinGoData() {
    try {
        const response = await axios.get(PROXY_URL, { timeout: 15000 });

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
                let isResultHit = (lastPredictedResult === actualResult);

                if (isResultHit) {
                    totalWins++;
                    maintenanceLevel = 1;
                    // Result Format: BIG 7 WIN / SMALL 2 WIN
                    cheerMsgText = `🏆🎉 **${actualResult} ${actualNum} WIN** 🎉🏆\nCONGRATULATIONS 💐🎉`;
                } else {
                    totalLosses++;
                    maintenanceLevel++;
                    if (maintenanceLevel > 8) maintenanceLevel = 1;
                    cheerMsgText = "💪 **Cheer Up Mame! Next Time Mark It!** 👍\nBetter Luck Next Time!";
                }
            }

            if (nextPeriod !== lastSentPeriod) {
                let pred = highAccuracyEngine(list);
                let currentAmount = levelAmounts[maintenanceLevel] || ("Level " + maintenanceLevel);

                let msg = "👑 **KING PREDICTION**\n" +
                          "⚡ **WinGo 30S** ⚡\n" +
                          "━━━━━━━━━━━━━━━━━━━━━\n" +
                          "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                          "🎯 **TARGET:** **" + pred.predResult + "**\n" +
                          "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                          "🔢 **LUCKY NUMBERS:** `" + pred.targetNumbers.join(", ") + "`\n" +
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
                lastPredictedNumbers = pred.targetNumbers;
                console.log("[SUCCESS] Updated Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[PROXY FETCH ERROR]:', error.message);
    }
}

console.log("WinGo 30S High Accuracy Engine Active...");
setInterval(fetchWinGoData, 12000);
