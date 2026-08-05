const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render Ping (24/7 Active)
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('WinGo 30S High Accuracy Bot Active!'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is listening on port ${PORT}`);
});

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
let lastPredictedColorType = null;
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let maintenanceLevel = 1;

// Level Amounts
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

function getActualColorInfo(num) {
    if (num === 0) return { full: "RED / VIOLET", type: "RED" };
    if (num === 5) return { full: "GREEN / VIOLET", type: "GREEN" };
    if ([1, 3, 7, 9].includes(num)) return { full: "GREEN", type: "GREEN" };
    return { full: "RED", type: "RED" };
}

// 🎯 PATTERN & COLOUR FIRST ENGINE
function highAccuracyEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "BIG" : "SMALL");

        let last10 = allResults.slice(0, 10);
        let predResult = "BIG";

        // Pattern Check: Dragon (Streak)
        if (last10[0] === last10[1] && last10[1] === last10[2]) {
            predResult = last10[0];
        } 
        // Pattern Check: Alternate / Mirror (B, S, B, S)
        else if (last10[0] !== last10[1] && last10[1] !== last10[2] && last10[2] !== last10[3]) {
            predResult = last10[0] === "BIG" ? "SMALL" : "BIG";
        } 
        // Trend Bias
        else {
            let countB = last10.filter(x => x === "BIG").length;
            predResult = countB >= 5 ? "BIG" : "SMALL";
        }

        // Colour & Lucky Number Mapping
        let mainColorType = predResult === "BIG" ? "GREEN" : "RED";
        let targetNumbers = predResult === "BIG" ? [7, 8] : [1, 2];
        let colorStr = mainColorType === "GREEN" ? "🟢 GREEN" : "🔴 RED";

        if (targetNumbers.includes(0) || targetNumbers.includes(5)) {
            colorStr += " / 🟣 VIOLET";
        }

        return { predResult, targetNumbers, colorStr, mainColorType };

    } catch (e) {
        console.error("Engine Error:", e.message);
        return { predResult: "BIG", targetNumbers: [7, 8], colorStr: "🟢 GREEN", mainColorType: "GREEN" };
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
            let actualColorInfo = getActualColorInfo(actualNum);
            let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue);
            
            let nextPeriod = String(BigInt(actualPeriod) + 1n);
            let cheerMsgText = "";

            if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
                let isResultHit = (lastPredictedResult === actualResult);
                let isNumberHit = Array.isArray(lastPredictedNumbers) && lastPredictedNumbers.includes(actualNum);
                let isColorHit = (lastPredictedColorType === actualColorInfo.type);

                if (isResultHit) {
                    totalWins++;
                    maintenanceLevel = 1;
                    
                    if (isNumberHit && isColorHit) {
                        cheerMsgText = `🏆🎉 **${actualResult} ${actualNum} ${actualColorInfo.type} JACKPOT WIN** 🎉🏆\nCONGRATULATIONS 💐🎉`;
                    } else {
                        cheerMsgText = `🏆🎉 **${actualResult} WIN** 🎉🏆\nCONGRATULATIONS 💐🎉`;
                    }
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
                lastPredictedColorType = pred.mainColorType;
                console.log("[SUCCESS] Updated Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[PROXY FETCH ERROR]:', error.message);
    }
}

console.log("WinGo 30S High Accuracy Engine Active...");
setInterval(fetchWinGoData, 10000);
