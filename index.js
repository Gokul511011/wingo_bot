const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server Setup (Render 24/7 Keeping Alive)
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('WinGo 30S Hourly Report Bot Active!'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});

// Bot Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';

// Scrape.do Proxy API
const SCRAPE_DO_TOKEN = '4ddb13d503da4001819d56960d645d7adef32fa264b';
const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=50&pageNo=1';
const PROXY_URL = `https://api.scrape.do/?token=${SCRAPE_DO_TOKEN}&url=${encodeURIComponent(TARGET_URL)}`;
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedNumbers = []; 
let lastPredictedColorType = null;
let lastPredictedPeriod = null;

// Overall Stats
let totalWins = 0;
let totalLosses = 0;
let maintenanceLevel = 1;

// 60-Data Hourly Tracking Variables
let hourlyRoundCount = 0;
let hourlyWins = 0;
let hourlyLosses = 0;
let hourlyNetProfit = 0; // Total Net Money Profit
let levelWinStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };

// Investment & Return Matrix (Assuming 1.96x payout)
const levelAmounts = {
    1: 1,
    2: 3,
    3: 9,
    4: 27,
    5: 81,
    6: 243,
    7: 729,
    8: 1300
};

function getActualColorInfo(num) {
    if (num === 0) return { full: "RED / VIOLET", type: "RED" };
    if (num === 5) return { full: "GREEN / VIOLET", type: "GREEN" };
    if ([1, 3, 7, 9].includes(num)) return { full: "GREEN", type: "GREEN" };
    return { full: "RED", type: "RED" };
}

// 🎯 ULTRA HIGH ACCURACY ENGINE v3.0
function highAccuracyEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "BIG" : "SMALL");

        let last15 = allResults.slice(0, 15);
        let predResult = "BIG";

        let countB = last15.filter(x => x === "BIG").length;
        let countS = last15.length - countB;

        if (last15[0] === last15[1] && last15[1] === last15[2]) {
            predResult = last15[0];
        } else if (last15[1] === last15[2] && last15[0] !== last15[1]) {
            predResult = last15[0];
        } else if (last15[0] !== last15[1] && last15[1] !== last15[2] && last15[2] !== last15[3]) {
            predResult = last15[0] === "BIG" ? "SMALL" : "BIG";
        } else {
            if (countB >= 9) {
                predResult = "BIG";
            } else if (countS >= 9) {
                predResult = "SMALL";
            } else {
                predResult = last15[0] === "BIG" ? "SMALL" : "BIG";
            }
        }

        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let recent20 = allNumbers.slice(0, 20);
        let freqMap = {};
        
        candidateNums.forEach(n => freqMap[n] = 0);
        recent20.forEach((n, idx) => {
            if (candidateNums.includes(n)) {
                freqMap[n] += (20 - idx); 
            }
        });

        let sortedCandidates = candidateNums.sort((a, b) => freqMap[b] - freqMap[a]);
        let targetNumbers = [sortedCandidates[0], sortedCandidates[1]];

        let mainColorType = predResult === "BIG" ? "GREEN" : "RED";
        let colorStr = mainColorType === "GREEN" ? "🟢 GREEN" : "🔴 RED";

        if (targetNumbers.includes(0) || targetNumbers.includes(5)) {
            colorStr += " / 🟣 VIOLET";
        }

        return { predResult, targetNumbers, colorStr, mainColorType };

    } catch (e) {
        console.error("Engine Error:", e.message);
        return { predResult: "BIG", targetNumbers: [7, 8], colorStr: "🟢 GREEN", mainColorType: "GREEN" };
    }
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
            let actualColorInfo = getActualColorInfo(actualNum);
            let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue);
            
            let nextPeriod = String(BigInt(actualPeriod) + 1n);
            let cheerMsgText = "";

            if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
                hourlyRoundCount++;
                let isResultHit = (lastPredictedResult === actualResult);
                let isNumberHit = Array.isArray(lastPredictedNumbers) && lastPredictedNumbers.includes(actualNum);
                let isColorHit = (lastPredictedColorType === actualColorInfo.type);

                let currentStake = levelAmounts[maintenanceLevel] || 1;

                if (isResultHit) {
                    totalWins++;
                    hourlyWins++;
                    
                    // Win Payout Calc (Approx 1.96x return -> Profit = stake * 0.96)
                    let profitGain = currentStake * 0.96;
                    hourlyNetProfit += profitGain;

                    // Track Level Win
                    if (levelWinStats[maintenanceLevel] !== undefined) {
                        levelWinStats[maintenanceLevel]++;
                    }

                    maintenanceLevel = 1; // Reset Level
                    
                    if (isNumberHit && isColorHit) {
                        cheerMsgText = `🏆🎉 **${actualResult} ${actualNum} ${actualColorInfo.type} JACKPOT WIN** 🎉🏆\nCONGRATULATIONS 💐🎉`;
                    } else {
                        cheerMsgText = `🏆🎉 **${actualResult} WIN** 🎉🏆\nCONGRATULATIONS 💐🎉`;
                    }
                } else {
                    totalLosses++;
                    hourlyLosses++;

                    // Deduct Loss Stake Amount
                    hourlyNetProfit -= currentStake;

                    maintenanceLevel++;
                    if (maintenanceLevel > 8) maintenanceLevel = 1;
                    cheerMsgText = "💪 **Cheer Up Mame! Next Time Mark It!** 👍\nBetter Luck Next Time!";
                }
            }

            if (nextPeriod !== lastSentPeriod) {
                let pred = highAccuracyEngine(list);
                let currentAmount = "₹" + (levelAmounts[maintenanceLevel] || 1);

                let msg = "👑 **KING PREDICTION**\n" +
                          "⚡ **WinGo 30S** ⚡\n" +
                          "━━━━━━━━━━━━━━━━━━━━━\n" +
                          "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                          "🎯 **TARGET:** **" + pred.predResult + "**\n" +
                          "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                          "🔢 **LUCKY NUMBERS:** `" + pred.targetNumbers.join(", ") + "`\n" +
                          "💰 **LEVEL AMOUNT:** **Level " + maintenanceLevel + " (" + currentAmount + ")**\n" +
                          "━━━━━━━━━━━━━━━━━━━━━\n";

                if (cheerMsgText !== "") {
                    msg += cheerMsgText + "\n━━━━━━━━━━━━━━━━━━━━━\n";
                }

                msg += "🏆 **TOTAL WINS:** **" + totalWins + "**\n" +
                       "💔 **TOTAL LOSS:** **" + totalLosses + "**\n\n" +
                       "🔗 **Register Link:**\n" + REGISTER_LINK;

                await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });

                lastSentPeriod = nextPeriod;
                lastPredictedPeriod = nextPeriod;
                lastPredictedResult = pred.predResult;
                lastPredictedNumbers = pred.targetNumbers;
                lastPredictedColorType = pred.mainColorType;

                // 📊 60 ROUNDS (1 HOUR) HOURLY REPORT SUMMARY
                if (hourlyRoundCount >= 60) {
                    let nowStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
                    
                    let summaryMsg = "📊 **HOURLY PERFORMANCE REPORT (60 DATA)** 📊\n" +
                                     "📅 **DATE & TIME:** `" + nowStr + "`\n" +
                                     "━━━━━━━━━━━━━━━━━━━━━\n" +
                                     "✅ **TOTAL WINS:** **" + hourlyWins + "** / 60\n" +
                                     "❌ **TOTAL LOSSES:** **" + hourlyLosses + "** / 60\n" +
                                     "━━━━━━━━━━━━━━━━━━━━━\n" +
                                     "🎯 **LEVEL-WISE WIN BREAKDOWN:**\n" +
                                     "• Level 1 Wins: **" + levelWinStats[1] + "**\n" +
                                     "• Level 2 Wins: **" + levelWinStats[2] + "**\n" +
                                     "• Level 3 Wins: **" + levelWinStats[3] + "**\n" +
                                     "• Level 4 Wins: **" + levelWinStats[4] + "**\n" +
                                     "• Level 5 Wins: **" + levelWinStats[5] + "**\n" +
                                     "• Level 6 Wins: **" + levelWinStats[6] + "**\n" +
                                     "• Level 7 Wins: **" + levelWinStats[7] + "**\n" +
                                     "• Level 8 Wins: **" + levelWinStats[8] + "**\n" +
                                     "━━━━━━━━━━━━━━━━━━━━━\n" +
                                     "💰 **ESTIMATED NET PROFIT:** **₹" + hourlyNetProfit.toFixed(2) + "**\n" +
                                     "━━━━━━━━━━━━━━━━━━━━━\n" +
                                     "🔥 *Pattern Engine Auto-Calculated for 60 Rounds.*";

                    await bot.sendMessage(CHANNEL_ID, summaryMsg, { parse_mode: 'Markdown' });

                    // Reset Hourly Counter for Next 60 Data
                    hourlyRoundCount = 0;
                    hourlyWins = 0;
                    hourlyLosses = 0;
                    hourlyNetProfit = 0;
                    levelWinStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
                }

                console.log("[SUCCESS] Updated Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[PROXY FETCH ERROR]:', error.message);
    }
}

console.log("WinGo 30S High Accuracy Engine Active...");
setInterval(fetchWinGoData, 10000);
