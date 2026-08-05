const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 30S Pattern & Deep History Engine Active!'));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port " + PORT));

// Config
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPER_API_KEY = 'fc6dfaab549908b96eb0e95cf75f563f';

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=1000&pageNo=1';
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedNumbers = [];
let lastPredictedColor = "";
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let consecLosses = 0;
let maintenanceLevel = 1;

// 60 Predictions History Array
let prediction60History = [];

const levelAmounts = {
    1: "₹10", 2: "₹30", 3: "₹90", 4: "₹270", 5: "₹810", 6: "₹2430", 7: "₹7290"
};

// 🎯 DEEP HISTORY PATTERN ENGINE
function deepHistoryPatternEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let recentPattern = allResults.slice(0, 4).join(""); 
        let predResult = "BIG";

        // 1. Dragon Pattern
        if (allResults[0] === allResults[1] && allResults[1] === allResults[2]) {
            predResult = allResults[0] === "B" ? "BIG" : "SMALL";
        } 
        // 2. Zig-Zag Pattern Check
        else if (allResults[0] !== allResults[1] && allResults[1] !== allResults[2] && allResults[2] !== allResults[3]) {
            predResult = allResults[0] === "B" ? "SMALL" : "BIG";
        }
        // 3. Double Pattern Check
        else if (allResults[0] === allResults[1] && allResults[2] === allResults[3] && allResults[0] !== allResults[2]) {
            predResult = allResults[0] === "B" ? "SMALL" : "BIG";
        }
        // 4. Page 1 & Deep History Matching (50 to 100 Pages Lookup)
        else {
            let scoreB = 0;
            let scoreS = 0;

            for (let i = 1; i < allResults.length - 5; i++) {
                let historicalSeq = allResults.slice(i, i + 4).join("");
                if (recentPattern === historicalSeq) {
                    let nextItem = allResults[i - 1];
                    if (nextItem === "B") scoreB++;
                    if (nextItem === "S") scoreS++;
                }
            }

            if (scoreB > scoreS) predResult = "BIG";
            else if (scoreS > scoreB) predResult = "SMALL";
            else predResult = allResults[0] === "B" ? "BIG" : "SMALL"; 
        }

        // 🔢 SMART NUMBER PATTERN ENGINE
        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let recent3Nums = allNumbers.slice(0, 3);
        let matchedNumbers = [];

        for (let i = 1; i < allNumbers.length - 4; i++) {
            let matches = 0;
            if (allNumbers[i] === recent3Nums[0]) matches++;
            if (allNumbers[i + 1] === recent3Nums[1]) matches++;
            if (allNumbers[i + 2] === recent3Nums[2]) matches++;

            if (matches >= 2) { 
                let historicalNextNum = allNumbers[i - 1];
                if (candidateNums.includes(historicalNextNum) && !matchedNumbers.includes(historicalNextNum)) {
                    matchedNumbers.push(historicalNextNum);
                }
            }
            if (matchedNumbers.length >= 2) break;
        }

        if (matchedNumbers.length < 2) {
            let defaultPicks = candidateNums.filter(n => !matchedNumbers.includes(n));
            matchedNumbers.push(...defaultPicks.slice(0, 2 - matchedNumbers.length));
        }

        let numbersStr = matchedNumbers.join(", ");
        let mainColor = predResult === "BIG" ? "GREEN" : "RED";
        let colorStr = mainColor === "GREEN" ? "🟢 GREEN" : "🔴 RED";
        if (matchedNumbers.includes(0) || matchedNumbers.includes(5)) {
            colorStr += " / 🟣 VIOLET";
        }

        return { predResult, targetNumbers: matchedNumbers, numbersStr, colorStr, mainColor };

    } catch (e) {
        console.error("Pattern Engine Error:", e.message);
        return { predResult: "BIG", targetNumbers: [7, 8], numbersStr: "7, 8", colorStr: "🟢 GREEN", mainColor: "GREEN" };
    }
}

async function fetchWinGoData() {
    try {
        const scraperUrl = "http://api.scraperapi.com?api_key=" + SCRAPER_API_KEY + "&url=" + encodeURIComponent(TARGET_URL);
        const response = await axios.get(scraperUrl, { timeout: 8000 });
        let data = response.data;

        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) {}
        }

        let list = data?.data?.list || data?.list || data;

        if (Array.isArray(list) && list.length > 0) {
            let lastItem = list[0];
            let actualNum = parseInt(lastItem.number !== undefined ? lastItem.number : lastItem.result);
            let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
            let actualColor = (actualNum === 0 || actualNum === 5) ? "VIOLET" : (actualNum >= 5 ? "GREEN" : "RED");
            let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue);
            
            let nextPeriod = String(BigInt(actualPeriod) + 1n);
            let dynamicWinMsg = "";

            if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
                let isResultHit = (lastPredictedResult === actualResult);
                let isNumberHit = lastPredictedNumbers.includes(actualNum);
                let isColorHit = (lastPredictedColor === actualColor) || (actualColor === "VIOLET");

                let currentLevelExecuted = maintenanceLevel;

                if (isResultHit) {
                    totalWins++;
                    consecLosses = 0;

                    let winParts = [];
                    if (isResultHit) winParts.push(actualResult + " WIN");
                    if (isNumberHit) winParts.push(actualNum + " WIN");
                    if (isColorHit) winParts.push(actualColor + " WIN");
                    if (isNumberHit) winParts.push("JACKPOT NUMBERS");

                    dynamicWinMsg = "🏆 **" + winParts.join(" ") + "** 🏆";

                    // Store Win & Level details
                    prediction60History.unshift({ period: actualPeriod, status: "WIN", level: currentLevelExecuted });
                    maintenanceLevel = 1;

                } else {
                    totalLosses++;
                    consecLosses++;
                    
                    prediction60History.unshift({ period: actualPeriod, status: "LOSS", level: currentLevelExecuted });
                    maintenanceLevel++;
                    if (maintenanceLevel > 7) maintenanceLevel = 1;
                }

                // Keep only last 60 records
                if (prediction60History.length > 60) {
                    prediction60History.pop();
                }
            }

            if (nextPeriod !== lastSentPeriod) {
                let pred = deepHistoryPatternEngine(list);
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

                if (dynamicWinMsg !== "") {
                    msg += dynamicWinMsg + "\n━━━━━━━━━━━━━━━━━━━━━\n";
                }

                // 📊 60 PREDICTIONS LEVEL-WISE SUMMARY LOGIC
                let historyLen = prediction60History.length;
                let wins60 = prediction60History.filter(x => x.status === "WIN").length;
                let losses60 = prediction60History.filter(x => x.status === "LOSS").length;

                // Level Count Calculation
                let levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
                prediction60History.forEach(item => {
                    if (item.status === "WIN" && item.level >= 1 && item.level <= 7) {
                        levelCounts[item.level]++;
                    }
                });

                msg += "\n📊 **LAST " + historyLen + " PREDICTIONS REPORT:**\n" +
                       "━━━━━━━━━━━━━━━━━━━━━\n" +
                       "🏆 **TOTAL WINS:** " + wins60 + " / " + historyLen + "\n" +
                       "💔 **TOTAL LOSSES:** " + losses60 + " / " + historyLen + "\n\n" +
                       "🎯 **LEVEL WINS BREAKDOWN:**\n" +
                       "• **Level 1 Wins:** " + levelCounts[1] + "\n" +
                       "• **Level 2 Wins:** " + levelCounts[2] + "\n" +
                       "• **Level 3 Wins:** " + levelCounts[3] + "\n" +
                       "• **Level 4 Wins:** " + levelCounts[4] + "\n" +
                       "• **Level 5 Wins:** " + levelCounts[5] + "\n" +
                       "• **Level 6 Wins:** " + levelCounts[6] + "\n" +
                       "• **Level 7 Wins:** " + levelCounts[7] + "\n" +
                       "━━━━━━━━━━━━━━━━━━━━━\n\n" +
                       "🔗 **Register Link:**\n" + REGISTER_LINK;

                await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });

                lastSentPeriod = nextPeriod;
                lastPredictedPeriod = nextPeriod;
                lastPredictedResult = pred.predResult;
                lastPredictedNumbers = pred.targetNumbers;
                lastPredictedColor = pred.mainColor;
                console.log("[SUCCESS] Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[FETCH ERROR]:', error.message);
    }
}

setInterval(fetchWinGoData, 3000);
