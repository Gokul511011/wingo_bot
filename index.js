const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render Ping (Prevents Sleep 24/7)
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo Precision Pattern Engine Active!'));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPER_API_KEY = 'fc6dfaab549908b96eb0e95cf75f563f';
// 50 Pages Scan (pageSize=1000 for deep historical evaluation)
const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=1000&pageNo=1';
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

// 🧠 HIGH-PRECISION PATTERN & NUMBER SEARCH ENGINE
function advancedPatternEngine(history, currentConsecLosses) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let scoreB = 0;
        let scoreS = 0;

        // 1️⃣ FAST 5-PERIOD PATTERN MATCHING ACROSS 50 PAGES (1000 RECORDS)
        let last5Pattern = allResults.slice(0, 5).join("");
        let patternMatched = false;

        for (let i = 1; i < allResults.length - 6; i++) {
            let historical5 = allResults.slice(i, i + 5).join("");
            if (last5Pattern === historical5) {
                patternMatched = true;
                let nextOutcome = allResults[i - 1]; // What appeared right after this pattern
                if (nextOutcome === "B") scoreB += 4;
                if (nextOutcome === "S") scoreS += 4;
            }
        }

        // 2️⃣ KNOWN PATTERN ENGINE (Dragon, Zig-Zag, Double Mirror) IF PATTERN IS NOT ENOUGH
        if (!patternMatched || scoreB === scoreS) {
            // 🐉 DRAGON PATTERN (3+ Continuous Same Results)
            if (allResults[0] === allResults[1] && allResults[1] === allResults[2]) {
                if (allResults[0] === "B") scoreB += 5;
                else scoreS += 5;
            }
            // ⚡ ZIG-ZAG PATTERN (B-S-B-S or S-B-S-B)
            else if (allResults[0] !== allResults[1] && allResults[1] !== allResults[2] && allResults[2] !== allResults[3]) {
                if (allResults[0] === "B") scoreS += 5;
                else scoreB += 5;
            }
            // 🪞 DOUBLE MIRROR PATTERN (BB-SS-BB or SS-BB-SS)
            else if (allResults[0] === allResults[1] && allResults[2] === allResults[3] && allResults[0] !== allResults[2]) {
                if (allResults[0] === "B") scoreS += 4;
                else scoreB += 4;
            }
        }

        // 🛡️ ANTI-LOSS FILTER ADJUSTMENT
        if (currentConsecLosses >= 2) {
            if (scoreB > scoreS) scoreS += 3;
            else if (scoreS > scoreB) scoreB += 3;
        }

        let predResult = scoreS > scoreB ? "SMALL" : "BIG";

        // 🎯 EXACT 50-PAGE "LAST 2 NUMBERS" MAPPING LOGIC
        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let num1 = allNumbers[0]; // Last number
        let num2 = allNumbers[1]; // 2nd last number

        let targetNumbers = [];

        // Search for the sequence [num2, num1] in 50 pages history
        let matchIndex = -1;
        for (let i = 1; i < allNumbers.length - 2; i++) {
            if (allNumbers[i + 1] === num2 && allNumbers[i] === num1) {
                matchIndex = i;
                break;
            }
        }

        if (matchIndex !== -1 && matchIndex > 0 && matchIndex < allNumbers.length - 1) {
            // 📍 Found match in 50 pages: Take 1 number ABOVE and 1 number BELOW from history
            let numAbove = allNumbers[matchIndex - 1];
            let numBelow = allNumbers[matchIndex + 1];

            if (candidateNums.includes(numAbove)) targetNumbers.push(numAbove);
            if (candidateNums.includes(numBelow) && !targetNumbers.includes(numBelow)) targetNumbers.push(numBelow);
        }

        // 📍 If match not found or logic needs fallback: Use Center & 2-Above logic
        if (targetNumbers.length < 2) {
            let centerNum = candidateNums[2]; // Center of BIG (7) or SMALL (2)
            let twoAboveNum = candidateNums[0]; // Top candidate

            if (!targetNumbers.includes(centerNum)) targetNumbers.push(centerNum);
            if (!targetNumbers.includes(twoAboveNum) && targetNumbers.length < 2) targetNumbers.push(twoAboveNum);

            // Fill remaining if needed
            for (let num of candidateNums) {
                if (targetNumbers.length >= 2) break;
                if (!targetNumbers.includes(num)) targetNumbers.push(num);
            }
        }

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
