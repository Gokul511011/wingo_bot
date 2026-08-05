const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render Ping (24/7 Active)
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 30S 50-History Engine Active!'));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPE_DO_TOKEN = '299ec0cbfd074bda8bffa9ddd82d0384abc2c59eb36'; 

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=1000&pageNo=1';
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedNumbers = [];
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let maintenanceLevel = 1;
let skipCounter = 0;

const levelAmounts = {
    1: "₹10",
    2: "₹30",
    3: "₹90",
    4: "₹270",
    5: "₹810",
    6: "₹2430",
    7: "₹7290"
};

// 🎯 50-HISTORY PATTERN ANALYSIS ENGINE
function patternAnalysisEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        // 1. Dragon Check (3 Consecutive Same Results)
        let last3 = allResults.slice(0, 3);
        if (last3[0] === last3[1] && last3[1] === last3[2]) {
            let predRes = last3[0] === "B" ? "BIG" : "SMALL";
            return generateOutput(predRes, allNumbers);
        }

        // 2. Exact 5-Pattern Matching across Last 50 Results
        let last5 = allResults.slice(0, 5);
        let pattern5Str = last5.join("");

        let history50 = allResults.slice(0, 50);
        let scoreB = 0;
        let scoreS = 0;

        for (let i = 1; i < history50.length - 5; i++) {
            let subPattern = history50.slice(i, i + 5).join("");
            if (pattern5Str === subPattern) {
                let nextOutcome = history50[i - 1];
                if (nextOutcome === "B") scoreB += 10;
                if (nextOutcome === "S") scoreS += 10;
            }
        }

        let patternNext = scoreB >= scoreS ? "BIG" : "SMALL";

        // 3. Fallback Trend Balance if no match in 50 history
        if (scoreB === 0 && scoreS === 0) {
            let bigCount = history50.filter(r => r === "B").length;
            patternNext = bigCount >= 25 ? "BIG" : "SMALL";
        }

        return generateOutput(patternNext, allNumbers);

    } catch (e) {
        console.error("Pattern Engine Error:", e.message);
        return generateOutput("BIG", [7, 8]);
    }
}

function generateOutput(predResult, allNumbers) {
    let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
    
    // Pick most frequent numbers in candidate pool from last 20 results
    let recentNums = allNumbers.slice(0, 20);
    let freqMap = {};
    candidateNums.forEach(n => freqMap[n] = 0);

    recentNums.forEach(n => {
        if (candidateNums.includes(n)) {
            freqMap[n] = (freqMap[n] || 0) + 1;
        }
    });

    let sortedCandidates = candidateNums.sort((a, b) => freqMap[b] - freqMap[a]);
    let targetNumbers = sortedCandidates.slice(0, 2);

    let numbersStr = targetNumbers.join(", ");
    let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";

    return { predResult, targetNumbers, numbersStr, colorStr };
}

async function fetchWinGoData() {
    try {
        const encodedTarget = encodeURIComponent(TARGET_URL);
        const proxyUrl = `http://api.scrape.do?token=${SCRAPE_DO_TOKEN}&url=${encodedTarget}&super=true`;

        const response = await axios.get(proxyUrl, { timeout: 15000 });

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
                    maintenanceLevel = 1;

                    if (isNumberHit) {
                        cheerMsgText = "💥 **WINNER JACKPOT (EXACT NUMBER HIT)** 💥\nCONGRATULATIONS 💐🎉";
                    } else {
                        cheerMsgText = "🏆🎉 **BIG WINNER** 🎉🏆\nCONGRATULATIONS 💐🎉";
                    }
                } else {
                    totalLosses++;
                    maintenanceLevel++;
                    cheerMsgText = "💪 **Cheer Up Mame! Next Time Mark It!** 👍\nBetter Luck Next Time!";

                    if (maintenanceLevel > 7) {
                        maintenanceLevel = 1;
                    }

                    // Strict Skip 2 periods after 1 loss
                    skipCounter = 2;
                }
            }

            if (nextPeriod !== lastSentPeriod) {
                if (skipCounter > 0) {
                    console.log(`[SAFE SKIP] Skipping period ${nextPeriod}. Skips left: ${skipCounter}`);
                    skipCounter--;
                    lastSentPeriod = nextPeriod;
                    lastPredictedPeriod = null;
                    return;
                }

                let pred = patternAnalysisEngine(list);
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
                console.log("[SUCCESS] WinGo 30S Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[FETCH ERROR]:', error.message);
    }
}

console.log("WinGo 30S 50-History Engine Active...");
setInterval(fetchWinGoData, 15000);
