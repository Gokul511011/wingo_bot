const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Keep-Alive Server for Render (24/7 Background Run)
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 40+ Pattern Ultra Engine Active!'));
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
let maintenanceLevel = 1;
let isMaintenancePause = false;

const levelAmounts = {
    1: "₹10",
    2: "₹30",
    3: "₹90",
    4: "₹270",
    5: "₹810",
    6: "₹2430",
    7: "₹7290"
};

// 🧠 40+ PATTERN ENGINE (Dragon, Zig-Zag, Inverted, Mirror & High-Precision Numbers)
function advancedPatternEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let predResult = null;

        // 🐉 1. DRAGON PATTERN CHECK (Continuous 4+ BIG or SMALL)
        let dragonCount = 1;
        for (let i = 0; i < allResults.length - 1; i++) {
            if (allResults[i] === allResults[i + 1]) {
                dragonCount++;
            } else {
                break;
            }
        }
        if (dragonCount >= 4) {
            predResult = allResults[0] === "B" ? "BIG" : "SMALL";
        }

        // ⚡ 2. ZIG-ZAG PATTERN CHECK (Alternative B-S-B-S Pattern)
        if (!predResult) {
            let isZigZag = true;
            for (let i = 0; i < 3; i++) {
                if (allResults[i] === allResults[i + 1]) {
                    isZigZag = false;
                    break;
                }
            }
            if (isZigZag) {
                predResult = allResults[0] === "B" ? "SMALL" : "BIG";
            }
        }

        // 🔍 3. 40+ MULTI-PATTERN SCANNING (Direct & Inverted/Mirror Matching)
        if (!predResult) {
            let matchB = 0;
            let matchS = 0;

            // Scan pattern depths from length 6 down to 3 (covers 40+ combinations)
            for (let depth = 6; depth >= 3; depth--) {
                let currentPattern = allResults.slice(0, depth).join("");
                let invertedPattern = currentPattern.split("").map(ch => ch === "B" ? "S" : "B").join("");

                for (let i = 1; i < allResults.length - depth; i++) {
                    let pastPattern = allResults.slice(i, i + depth).join("");
                    
                    // Direct Match
                    if (currentPattern === pastPattern) {
                        let nextResult = allResults[i - 1];
                        if (nextResult === "B") matchB += depth;
                        if (nextResult === "S") matchS += depth;
                    }
                    
                    // Inverted/Opposite Mirror Match
                    if (invertedPattern === pastPattern) {
                        let nextResult = allResults[i - 1];
                        let mirrorNext = nextResult === "B" ? "S" : "B";
                        if (mirrorNext === "B") matchB += depth;
                        if (mirrorNext === "S") matchS += depth;
                    }
                }
                
                if (matchB > 0 || matchS > 0) break;
            }

            if (matchS > matchB) {
                predResult = "SMALL";
            } else if (matchB > matchS) {
                predResult = "BIG";
            } else {
                predResult = allResults[0] === "B" ? "BIG" : "SMALL";
            }
        }

        // 🎯 EXACT COLOR & NUMBER MATCHING (BIG = 🟢 GREEN [5-9] | SMALL = 🔴 RED [0-4])
        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let num1 = allNumbers[0];
        let num2 = allNumbers[1];

        let numFreqMap = {};

        // Frequency mapping over past history for 2-number target precision
        for (let i = 1; i < allNumbers.length - 2; i++) {
            if (allNumbers[i] === num1 && allNumbers[i + 1] === num2) {
                let numAbove = allNumbers[i - 1];
                let numBelow = allNumbers[i + 2];

                if (candidateNums.includes(numAbove)) {
                    numFreqMap[numAbove] = (numFreqMap[numAbove] || 0) + 3;
                }
                if (numBelow !== undefined && candidateNums.includes(numBelow)) {
                    numFreqMap[numBelow] = (numFreqMap[numBelow] || 0) + 1;
                }
            }
        }

        if (Object.keys(numFreqMap).length === 0) {
            allNumbers.slice(0, 20).filter(n => candidateNums.includes(n)).forEach(n => {
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
    if (isMaintenancePause) return;

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
                            console.log("[SYSTEM]: 1 Hour Maintenance Pause Ended.");
                        }, 3600000);

                        return;
                    }
                }
            }

            if (nextPeriod !== lastSentPeriod) {
                let pred = advancedPatternEngine(list);
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

console.log("WinGo ScraperAPI 40+ Pattern Bot Active...");
setInterval(fetchWinGoData, 15000);
