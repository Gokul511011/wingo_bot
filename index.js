const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render Ping (Prevents Sleep 24/7)
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 30S High-Accuracy Safe Engine Active!'));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';

// ⚡ 30S WinGo API Endpoint
const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=1000&pageNo=1';
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedNumbers = [];
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let consecLosses = 0;
let maintenanceLevel = 1;

let skipCounter = 0; // Smart Loss Skip Tracking

const levelAmounts = {
    1: "₹10",
    2: "₹30",
    3: "₹90",
    4: "₹270",
    5: "₹810",
    6: "₹2430",
    7: "₹7290"
};

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'
];

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// 🎯 HIGH-PRECISION DOUBLE FILTER ENGINE
function safePatternEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let last5 = allResults.slice(0, 5);

        // 🐉 1. DRAGON PATTERN CHECK
        let dragonCount = 1;
        for (let i = 0; i < last5.length - 1; i++) {
            if (last5[i] === last5[i + 1]) dragonCount++;
            else break;
        }

        if (dragonCount >= 3) {
            let predRes = last5[0] === "B" ? "BIG" : "SMALL";
            return generateOutput(predRes, allNumbers);
        }

        // ⚡ 2. 50-PAGE HISTORICAL PATTERN MATCH
        let pattern5Str = last5.join("");
        let scoreB = 0;
        let scoreS = 0;

        for (let i = 1; i < allResults.length - 6; i++) {
            let historical5 = allResults.slice(i, i + 5).join("");
            if (pattern5Str === historical5) {
                let nextOutcome = allResults[i - 1];
                if (nextOutcome === "B") scoreB += 5;
                if (nextOutcome === "S") scoreS += 5;
            }
        }

        let patternNext = scoreB >= scoreS ? "BIG" : "SMALL";

        // 📊 3. RECENT TREND RATIO FILTER (OVERALL 20 RESULTS)
        let recent20 = allResults.slice(0, 20);
        let bigCount = recent20.filter(r => r === "B").length;
        let trendNext = bigCount >= 10 ? "BIG" : "SMALL";

        // Double Confirmation: Filter Match
        let finalPred = (patternNext === trendNext) ? patternNext : (last5[0] === "B" ? "SMALL" : "BIG");

        return generateOutput(finalPred, allNumbers);

    } catch (e) {
        console.error("Pattern Engine Error:", e.message);
        return generateOutput("BIG", [7, 8]);
    }
}

function generateOutput(predResult, allNumbers) {
    let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
    let num1 = allNumbers[0];
    let num2 = allNumbers[1];

    let targetNumbers = [];

    let matchIndex = -1;
    for (let i = 1; i < allNumbers.length - 2; i++) {
        if (allNumbers[i + 1] === num2 && allNumbers[i] === num1) {
            matchIndex = i;
            break;
        }
    }

    if (matchIndex !== -1 && matchIndex > 0 && matchIndex < allNumbers.length - 1) {
        let numAbove = allNumbers[matchIndex - 1];
        let numBelow = allNumbers[matchIndex + 1];

        if (candidateNums.includes(numAbove)) targetNumbers.push(numAbove);
        if (candidateNums.includes(numBelow) && !targetNumbers.includes(numBelow)) targetNumbers.push(numBelow);
    }

    if (targetNumbers.length < 2) {
        let centerNum = candidateNums[2];
        let twoAboveNum = candidateNums[0];

        if (!targetNumbers.includes(centerNum)) targetNumbers.push(centerNum);
        if (!targetNumbers.includes(twoAboveNum) && targetNumbers.length < 2) targetNumbers.push(twoAboveNum);

        for (let num of candidateNums) {
            if (targetNumbers.length >= 2) break;
            if (!targetNumbers.includes(num)) targetNumbers.push(num);
        }
    }

    let numbersStr = targetNumbers.join(", ");
    let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";

    return { predResult, targetNumbers, numbersStr, colorStr };
}

async function fetchWinGoData() {
    try {
        const response = await axios.get(TARGET_URL, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'application/json, text/plain, */*',
                'Origin': 'https://draw.ar-lottery01.com',
                'Referer': 'https://draw.ar-lottery01.com/',
                'Cache-Control': 'no-cache'
            },
            timeout: 8000
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
                let isNumberHit = lastPredictedNumbers.includes(actualNum);

                if (lastPredictedResult === actualResult) {
                    totalWins++;
                    consecLosses = 0;
                    maintenanceLevel = 1;

                    if (isNumberHit) {
                        cheerMsgText = "💥 **WINNER JACKPOT (EXACT NUMBER HIT)** 💥\nCONGRATULATIONS 💐🎉";
                    } else {
                        cheerMsgText = "🏆🎉 **BIG WINNER** 🎉🏆\nCONGRATULATIONS 💐🎉";
                    }
                } else {
                    totalLosses++;
                    consecLosses++;
                    maintenanceLevel++;
                    cheerMsgText = "💪 **Cheer Up Mame! Next Time Mark It!** 👍\nBetter Luck Next Time!";

                    if (maintenanceLevel > 7) {
                        maintenanceLevel = 1;
                    }

                    // 🛡️ Trigger Loss Skip after 2 continuous losses
                    if (consecLosses >= 2) {
                        skipCounter = 2; // Skip next 2 periods
                    }
                }
            }

            if (nextPeriod !== lastSentPeriod) {
                // 🛑 Check if Bot is in Skip Mode
                if (skipCounter > 0) {
                    console.log(`[SAFE SKIP] Skipping period ${nextPeriod} to avoid loss streak. Remaining skips: ${skipCounter}`);
                    skipCounter--;
                    lastSentPeriod = nextPeriod;
                    lastPredictedPeriod = null; // Reset prediction during skip
                    return;
                }

                let pred = safePatternEngine(list);
                let currentAmount = levelAmounts[maintenanceLevel] || ("Level " + maintenanceLevel);

                let msg = "👑 **KING PREDICTION**\n" +
                          "⚡ **WinGo 30S** ⚡\n" +
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
                lastPredictedNumbers = pred.targetNumbers;
                console.log("[SUCCESS] WinGo 30S Safe Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[FETCH ERROR]:', error.message);
    }
}

console.log("WinGo 30S Safe Filter Engine Active...");
setInterval(fetchWinGoData, 10000);
