const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render Ping (24/7 Active)
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 30S Precision Engine Active!'));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';

// Updated Scrape.do Token
const SCRAPE_DO_TOKEN = '4ddb13d503da4001819d56960d645d7adef32fa264b';

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=1000&pageNo=1';
// Standard proxy call to save credits (no super=true)
const PROXY_URL = `https://api.scrape.do/?token=${SCRAPE_DO_TOKEN}&url=${encodeURIComponent(TARGET_URL)}`;
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedNumber = null;
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

// 🎯 HIGH PRECISION TREND & COLOUR ENGINE
function precisionEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let last3 = allResults.slice(0, 3);
        
        // 1. STREAK / DRAGON CONTINUITY
        if (last3[0] === last3[1] && last3[1] === last3[2]) {
            let predRes = last3[0] === "B" ? "BIG" : "SMALL";
            return generateOutput(predRes, allNumbers);
        }

        // 2. 50-HISTORY PATTERN MATCHING WITH TREND WEIGHTAGE
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

        let recent10 = allResults.slice(0, 10);
        let bigIn10 = recent10.filter(r => r === "B").length;
        if (bigIn10 >= 6) scoreB += 5;
        if (bigIn10 <= 4) scoreS += 5;

        let patternNext = scoreB >= scoreS ? "BIG" : "SMALL";
        return generateOutput(patternNext, allNumbers);

    } catch (e) {
        console.error("Precision Engine Error:", e.message);
        return generateOutput("BIG", [7]);
    }
}

function generateOutput(predResult, allNumbers) {
    let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
    
    let recentNums = allNumbers.slice(0, 15);
    let freqMap = {};
    candidateNums.forEach(n => freqMap[n] = 0);

    recentNums.forEach(n => {
        if (candidateNums.includes(n)) {
            freqMap[n] = (freqMap[n] || 0) + 1;
        }
    });

    let sortedCandidates = candidateNums.sort((a, b) => freqMap[b] - freqMap[a]);
    let targetNumber = sortedCandidates[0]; 

    let primaryColour = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";
    
    if (targetNumber === 0 || targetNumber === 5) {
        primaryColour += " / 🟣 VIOLET";
    }

    return { predResult, targetNumber, colorStr: primaryColour };
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
                let isExactNumberHit = (lastPredictedNumber === actualNum);

                if (lastPredictedResult === actualResult) {
                    totalWins++;
                    maintenanceLevel = 1;

                    if (isExactNumberHit) {
                        cheerMsgText = "💥 **JACKPOT WINNER (SINGLE NUMBER HIT)** 💥\nCONGRATULATIONS 💐🎉";
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

                let pred = precisionEngine(list);
                let currentAmount = levelAmounts[maintenanceLevel] || ("Level " + maintenanceLevel);

                let msg = "👑 **KING PREDICTION**\n" +
                          "⚡ **WinGo 30S** ⚡\n" +
                          "━━━━━━━━━━━━━━━━━━━━━\n" +
                          "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                          "🎯 **TARGET:** **" + pred.predResult + "**\n" +
                          "🎨 **COLOUR FOCUS:** " + pred.colorStr + "\n" +
                          "🔢 **SINGLE NUMBER:** `" + pred.targetNumber + "`\n" +
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
                lastPredictedNumber = pred.targetNumber;
                console.log("[SUCCESS] Proxy Fetch WinGo Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[PROXY FETCH ERROR]:', error.message);
    }
}

console.log("WinGo 30S Engine Active...");
// Fetch every 25s to save API credits
setInterval(fetchWinGoData, 25000);
