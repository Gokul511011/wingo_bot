const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render Ping (Prevents Sleep 24/7)
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 30S 5-Sequence Pattern Engine Active!'));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPER_API_KEY = 'fc6dfaab549908b96eb0e95cf75f563f';

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

let streakLockCount = 0;
let lockedPrediction = null;

const levelAmounts = {
    1: "₹10",
    2: "₹30",
    3: "₹90",
    4: "₹270",
    5: "₹810",
    6: "₹2430",
    7: "₹7290"
};

// 🎯 LAST 5 RESULTS PATTERN & DRAGON CALCULATION ENGINE
function analyzeLast5Sequence(resultsAll) {
    // Take recent 5 results
    let last5 = resultsAll.slice(0, 5); // Index 0 is most recent, 4 is 5th recent

    // 🐉 1. DRAGON PATTERN CHECK (3+ continuous same outcome)
    let dragonCount = 1;
    for (let i = 0; i < last5.length - 1; i++) {
        if (last5[i] === last5[i + 1]) dragonCount++;
        else break;
    }

    if (dragonCount >= 3) {
        // Continue Dragon Trend
        return { mode: "DRAGON", next: last5[0] === "B" ? "BIG" : "SMALL" };
    }

    // ⚡ 2. LAST 5 SEQUENCE PATTERN MATCHING ACROSS 50 PAGES HISTORY
    let pattern5Str = last5.join(""); // e.g. "BSBBB"
    let scoreB = 0;
    let scoreS = 0;

    for (let i = 1; i < resultsAll.length - 6; i++) {
        let historical5 = resultsAll.slice(i, i + 5).join("");
        if (pattern5Str === historical5) {
            let nextOutcome = resultsAll[i - 1]; // What appeared right after this 5-sequence
            if (nextOutcome === "B") scoreB += 5;
            if (nextOutcome === "S") scoreS += 5;
        }
    }

    if (scoreB > scoreS) return { mode: "PATTERN_MATCH", next: "BIG" };
    if (scoreS > scoreB) return { mode: "PATTERN_MATCH", next: "SMALL" };

    // 🪞 3. FALLBACK ZIG-ZAG / ALTERNATE RULE FOR 5-SEQUENCE
    // E.g., B S B S B -> next SMALL
    if (last5[0] !== last5[1] && last5[1] !== last5[2] && last5[2] !== last5[3]) {
        return { mode: "ZIGZAG", next: last5[0] === "B" ? "SMALL" : "BIG" };
    }

    // Default reverse of last result if no match
    return { mode: "REVERSE_FLOW", next: last5[0] === "B" ? "SMALL" : "BIG" };
}

// 🧠 HIGH-PRECISION PATTERN & NUMBER SEARCH ENGINE
function advancedPatternEngine(history, currentConsecLosses) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        // 1️⃣ ANALYZE LAST 5 SEQUENCE
        let seqAnalysis = analyzeLast5Sequence(allResults);

        if (seqAnalysis !== null && seqAnalysis.mode === "DRAGON") {
            streakLockCount = 0;
            lockedPrediction = null;
            return generateOutput(seqAnalysis.next, allNumbers);
        }

        // 2️⃣ LOSS PATTERN LOCK LOGIC (2+ Losses -> 5 Times Continuation)
        if (currentConsecLosses >= 2) {
            if (streakLockCount === 0) {
                lockedPrediction = allResults[0] === "B" ? "BIG" : "SMALL";
                streakLockCount = 5;
            }
        }

        if (streakLockCount > 0 && lockedPrediction) {
            streakLockCount--;
            return generateOutput(lockedPrediction, allNumbers);
        }

        // Return prediction calculated from Last 5 Sequence
        return generateOutput(seqAnalysis.next, allNumbers);

    } catch (e) {
        console.error("Pattern Engine Error:", e.message);
        return generateOutput("BIG", [7, 8]);
    }
}

// Helper to generate Number & Color output mapping (SAME LOGIC KEPT)
function generateOutput(predResult, allNumbers) {
    let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
    let num1 = allNumbers[0];
    let num2 = allNumbers[1];

    let targetNumbers = [];

    // Search last 2 numbers in 50 pages history
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
        const scraperUrl = "http://api.scraperapi.com?api_key=" + SCRAPER_API_KEY + "&url=" + encodeURIComponent(TARGET_URL);
        
        const response = await axios.get(scraperUrl, { timeout: 10000 });
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
                console.log("[SUCCESS] WinGo 30S 5-Sequence Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[SCRAPER ERROR]:', error.message);
    }
}

console.log("WinGo 30S 5-Sequence Engine Active...");
setInterval(fetchWinGoData, 5000);
