const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render (Prevents Sleep & Port Error)
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 30S Pattern Engine v3.1 Active!'));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPER_API_KEY = 'fc6dfaab549908b96eb0e95cf75f563f';

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

const levelAmounts = {
    1: "₹10",
    2: "₹30",
    3: "₹90",
    4: "₹270",
    5: "₹810",
    6: "₹2430",
    7: "₹7290"
};

// 🎯 ULTRA HIGH ACCURACY ENGINE v3.1
function highAccuracyEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "BIG" : "SMALL");

        let last15 = allResults.slice(0, 15);
        let predResult = "BIG";

        let countB = last15.filter(x => x === "BIG").length;
        let countS = last15.length - countB;

        // 1. DRAGON PATTERN (Thodarnthu 3+ same outcome)
        if (last15[0] === last15[1] && last15[1] === last15[2]) {
            predResult = last15[0];
        } 
        // 2. ZIG-ZAG PATTERN (B, S, B, S -> Alternate Trend)
        else if (last15[0] !== last15[1] && last15[1] !== last15[2] && last15[2] !== last15[3]) {
            predResult = last15[0] === "BIG" ? "SMALL" : "BIG";
        } 
        // 3. 1-2 STREAK RECOVERY
        else if (last15[1] === last15[2] && last15[0] !== last15[1]) {
            predResult = last15[0]; 
        }
        // 4. TREND DOMINANCE FILTER
        else {
            if (countB >= 9) {
                predResult = "BIG";
            } else if (countS >= 9) {
                predResult = "SMALL";
            } else {
                // Follow latest momentum
                predResult = last15[0];
            }
        }

        // 5. HIGH PROBABILITY LUCKY NUMBERS
        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let recent20 = allNumbers.slice(0, 20);
        let freqMap = {};
        
        candidateNums.forEach(n => freqMap[n] = 0);
        recent20.forEach((n, idx) => {
            if (candidateNums.includes(n)) {
                freqMap[n] += (20 - idx); 
            }
        });

        // Copy array before sorting to prevent mutation bug
        let sortedCandidates = [...candidateNums].sort((a, b) => freqMap[b] - freqMap[a]);
        let targetNumbers = [sortedCandidates[0], sortedCandidates[1]];

        let numbersStr = targetNumbers.join(", ");
        let mainColorType = predResult === "BIG" ? "GREEN" : "RED";
        let colorStr = mainColorType === "GREEN" ? "🟢 GREEN" : "🔴 RED";

        if (targetNumbers.includes(0) || targetNumbers.includes(5)) {
            colorStr += " / 🟣 VIOLET";
        }

        return { predResult, targetNumbers, numbersStr, colorStr, mainColorType };

    } catch (e) {
        console.error("Engine Error:", e.message);
        return { predResult: "BIG", targetNumbers: [7, 8], numbersStr: "7, 8", colorStr: "🟢 GREEN", mainColorType: "GREEN" };
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
                let pred = highAccuracyEngine(list);
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
                console.log("[SUCCESS] Prediction Sent for Period: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[FETCH ERROR]:', error.message);
    }
}

// Fetch every 3 seconds for quick alerts
setInterval(fetchWinGoData, 3000);
