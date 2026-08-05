const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render Ping (24/7 Active)
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 30S Dual Number Engine Active!'));
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

// 💰 Custom Level Amounts under ₹2,500 Budget (Total Max: ₹2,393)
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

// 🎯 DEEP TREND & DUAL NUMBER PRECISION ENGINE
function precisionEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let last3 = allResults.slice(0, 3);
        
        // 1. DRAGON / STREAK DETECTOR
        if (last3[0] === last3[1] && last3[1] === last3[2]) {
            let predRes = last3[0] === "B" ? "BIG" : "SMALL";
            return generateOutput(predRes, allNumbers);
        }

        // 2. PATTERN MATCHING ACROSS AVAILABLE HISTORY
        let last4 = allResults.slice(0, 4);
        let pattern4Str = last4.join("");
        
        let deepHistory = allResults; 

        let scoreB = 0;
        let scoreS = 0;

        for (let i = 1; i < deepHistory.length - 4; i++) {
            let subPattern = deepHistory.slice(i, i + 4).join("");
            if (pattern4Str === subPattern) {
                let nextOutcome = deepHistory[i - 1];
                if (nextOutcome === "B") scoreB += 15;
                if (nextOutcome === "S") scoreS += 15;
            }
        }

        // 3. RECENT MOMENTUM WEIGHTAGE (Last 10 & 20)
        let recent10 = allResults.slice(0, 10);
        let recent20 = allResults.slice(0, Math.min(20, allResults.length));
        
        let bigIn10 = recent10.filter(r => r === "B").length;
        let bigIn20 = recent20.filter(r => r === "B").length;

        if (bigIn10 >= 6) scoreB += 10;
        if (bigIn10 <= 4) scoreS += 10;

        if (bigIn20 >= 12) scoreB += 8;
        if (bigIn20 <= 8) scoreS += 8;

        let patternNext = scoreB >= scoreS ? "BIG" : "SMALL";
        return generateOutput(patternNext, allNumbers);

    } catch (e) {
        console.error("Precision Engine Error:", e.message);
        return generateOutput("BIG", [7, 8]);
    }
}

function generateOutput(predResult, allNumbers) {
    let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
    
    let recentNums = allNumbers.slice(0, Math.min(30, allNumbers.length));
    let freqMap = {};
    candidateNums.forEach(n => freqMap[n] = 0);

    recentNums.forEach((n, index) => {
        if (candidateNums.includes(n)) {
            let weight = index < 10 ? 3 : index < 20 ? 2 : 1;
            freqMap[n] = (freqMap[n] || 0) + weight;
        }
    });

    let sortedCandidates = candidateNums.sort((a, b) => freqMap[b] - freqMap[a]);
    let targetNumbers = [sortedCandidates[0], sortedCandidates[1]]; 

    let primaryColour = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";
    
    if (targetNumbers.includes(0) || targetNumbers.includes(5)) {
        primaryColour += " / 🟣 VIOLET";
    }

    return { predResult, targetNumbers, colorStr: primaryColour };
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
                let isNumberHit = Array.isArray(lastPredictedNumbers) && lastPredictedNumbers.includes(actualNum);

                if (lastPredictedResult === actualResult) {
                    totalWins++;
                    maintenanceLevel = 1;

                    if (isNumberHit) {
                        cheerMsgText = `💥 **JACKPOT WINNER (NUMBER ${actualNum} HIT)** 💥\nCONGRATULATIONS 💐🎉`;
                    } else {
                        cheerMsgText = "🏆🎉 **BIG WINNER** 🎉🏆\nCONGRATULATIONS 💐🎉";
                    }
                } else {
                    totalLosses++;
                    maintenanceLevel++;
                    cheerMsgText = "💪 **Cheer Up Mame! Next Time Mark It!** 👍\nBetter Luck Next Time!";

                    if (maintenanceLevel > 8) {
                        maintenanceLevel = 1;
                    }
                }
            }

            if (nextPeriod !== lastSentPeriod) {
                let pred = precisionEngine(list);
                let currentAmount = levelAmounts[maintenanceLevel] || ("Level " + maintenanceLevel);

                let msg = "👑 **KING PREDICTION**\n" +
                          "⚡ **WinGo 30S** ⚡\n" +
                          "━━━━━━━━━━━━━━━━━━━━━\n" +
                          "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                          "🎯 **TARGET:** **" + pred.predResult + "**\n" +
                          "🎨 **COLOUR FOCUS:** " + pred.colorStr + "\n" +
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
                console.log("[SUCCESS] Non-stop Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[PROXY FETCH ERROR]:', error.message);
    }
}

console.log("WinGo 30S Non-Stop Engine Active...");
setInterval(fetchWinGoData, 12000);
