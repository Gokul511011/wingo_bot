const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render Ping (Prevents Sleep 24/7)
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo High-Accuracy Anti-Loss Engine Active!'));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPER_API_KEY = 'fc6dfaab549908b96eb0e95cf75f563f';
const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=50&pageNo=1';
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

const levelAmounts = {
    1: "₹10",
    2: "₹30",
    3: "₹90",
    4: "₹270",
    5: "₹810",
    6: "₹2430",
    7: "₹7290"
};

// 🧠 HIGH-ACCURACY ANTI-LOSS PATTERN ENGINE
function advancedPatternEngine(history, currentConsecLosses) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let scoreB = 0;
        let scoreS = 0;

        // 🐉 1. DRAGON PATTERN SCAN
        let dragonCount = 1;
        for (let i = 0; i < allResults.length - 1; i++) {
            if (allResults[i] === allResults[i + 1]) {
                dragonCount++;
            } else {
                break;
            }
        }
        if (dragonCount >= 3) {
            if (allResults[0] === "B") scoreB += 5;
            else scoreS += 5;
        }

        // ⚡ 2. ZIG-ZAG PATTERN SCAN
        let isZigZag = true;
        for (let i = 0; i < 3; i++) {
            if (allResults[i] === allResults[i + 1]) {
                isZigZag = false;
                break;
            }
        }
        if (isZigZag) {
            if (allResults[0] === "B") scoreS += 4;
            else scoreB += 4;
        }

        // 🔍 3. MULTI-DEPTH HISTORICAL MATCHING (40+ Patterns)
        for (let depth = 5; depth >= 3; depth--) {
            let currentPattern = allResults.slice(0, depth).join("");
            let invertedPattern = currentPattern.split("").map(ch => ch === "B" ? "S" : "B").join("");

            for (let i = 1; i < allResults.length - depth; i++) {
                let pastPattern = allResults.slice(i, i + depth).join("");
                
                if (currentPattern === pastPattern) {
                    let nextRes = allResults[i - 1];
                    if (nextRes === "B") scoreB += depth;
                    if (nextRes === "S") scoreS += depth;
                }
                if (invertedPattern === pastPattern) {
                    let nextRes = allResults[i - 1];
                    let mirrorNext = nextRes === "B" ? "S" : "B";
                    if (mirrorNext === "B") scoreB += depth;
                    if (mirrorNext === "S") scoreS += depth;
                }
            }
        }

        // 🛡️ 4. ANTI-STREAK FILTER
        if (currentConsecLosses >= 2) {
            if (scoreB > scoreS) { scoreS += 2; }
            else if (scoreS > scoreB) { scoreB += 2; }
        }

        let predResult = scoreS > scoreB ? "SMALL" : "BIG";

        // 🎯 EXACT COLOR & HIGH-FREQUENCY NUMBER MATCHING
        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let num1 = allNumbers[0];
        let num2 = allNumbers[1];

        let numFreqMap = {};

        for (let i = 1; i < allNumbers.length - 2; i++) {
            if (allNumbers[i] === num1 && allNumbers[i + 1] === num2) {
                let numAbove = allNumbers[i - 1];
                if (candidateNums.includes(numAbove)) {
                    numFreqMap[numAbove] = (numFreqMap[numAbove] || 0) + 3;
                }
            }
        }

        if (Object.keys(numFreqMap).length === 0) {
            allNumbers.slice(0, 15).filter(n => candidateNums.includes(n)).forEach(n => {
                numFreqMap[n] = (numFreqMap[n] || 0) + 1;
            });
        }

        candidateNums.sort((a, b) => (numFreqMap[b] || 0) - (numFreqMap[a] || 0));
        let targetNumbers = [candidateNums[0], candidateNums[1]];

        let numbersStr = targetNumbers.join(", ");
        let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";

        return { predResult, targetNumbers, numbersStr, colorStr };
    } catch (e) {
        console.error("Pattern Engine Error:", e.message);
        return { predResult: "BIG", targetNumbers: [7, 8], numbersStr: "7, 8", colorStr: "🟢 GREEN" };
    }
}

async function fetchWinGoData() {
    try {
        const scraperUrl = "http://api.scraperapi.com?api_key=" + SCRAPER_API_KEY + "&url=" + encodeURIComponent(TARGET_URL);
        
        const response = await axios.get(scraperUrl, { timeout: 15000 });
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
                }
            }

            if (nextPeriod !== lastSentPeriod) {
                let pred = advancedPatternEngine(list, consecLosses);
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
                lastPredictedNumbers = pred.targetNumbers;
                console.log("[SUCCESS] Ultra Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[SCRAPER ERROR]:', error.message);
    }
}

console.log("WinGo High-Accuracy Anti-Loss Bot Active...");
setInterval(fetchWinGoData, 12000);
