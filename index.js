const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render Ping (24/7 Active)
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 30S Smart Engine Active!'));
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

// 🎯 HIGH-ACCURACY DYNAMIC TREND ENGINE
function smartTrendEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let last5 = allResults.slice(0, 5);

        // 1. DRAGON TREND CHECK (Same result repeated 2 or more times)
        if (last5[0] === last5[1] && last5[1] === last5[2]) {
            let predRes = last5[0] === "B" ? "BIG" : "SMALL";
            return generateOutput(predRes, allNumbers);
        }

        // 2. ZIG-ZAG PATTERN DETECTOR (B-S-B-S or S-B-S-B)
        if (last5[0] !== last5[1] && last5[1] !== last5[2] && last5[2] !== last5[3]) {
            let predRes = last5[0] === "B" ? "SMALL" : "BIG"; // Continue Zig-Zag
            return generateOutput(predRes, allNumbers);
        }

        // 3. SHORT TERM TREND WEIGHTAGE (Last 10 results)
        let recent10 = allResults.slice(0, 10);
        let bigCount = recent10.filter(r => r === "B").length;
        let smallCount = recent10.filter(r => r === "S").length;

        let finalPred = "BIG";
        if (bigCount > smallCount) {
            finalPred = "BIG";
        } else if (smallCount > bigCount) {
            finalPred = "SMALL";
        } else {
            finalPred = last5[0] === "B" ? "SMALL" : "BIG"; // Break tie with alternate
        }

        return generateOutput(finalPred, allNumbers);

    } catch (e) {
        console.error("Pattern Engine Error:", e.message);
        return generateOutput("BIG", [7, 8]);
    }
}

function generateOutput(predResult, allNumbers) {
    let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
    
    // Frequency calculation in recent 15 results
    let recentNums = allNumbers.slice(0, 15);
    let freqMap = {};
    candidateNums.forEach(n => freqMap[n] = 0);

    recentNums.forEach(n => {
        if (candidateNums.includes(n)) {
            freqMap[n] = (freqMap[n] || 0) + 1;
        }
    });

    // Sort candidate numbers by highest frequency
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

                    // 🛑 STRICT SKIP LOGIC: Skip 2 periods immediately after 1 loss
                    skipCounter = 2;
                }
            }

            if (nextPeriod !== lastSentPeriod) {
                if (skipCounter > 0) {
                    console.log(`[SAFE SKIP] Skipping period ${nextPeriod} to avoid market fluctuation. Skips left: ${skipCounter}`);
                    skipCounter--;
                    lastSentPeriod = nextPeriod;
                    lastPredictedPeriod = null;
                    return;
                }

                let pred = smartTrendEngine(list);
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
                console.log("[SUCCESS] WinGo 30S Smart Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[FETCH ERROR]:', error.message);
    }
}

console.log("WinGo 30S Smart Engine Active...");
setInterval(fetchWinGoData, 15000);
