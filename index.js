const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 4-Digit Scraper Engine Active!'));
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
let consecutiveLosses = 0;

let isCoolingDown = false;
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

// 🎯 STRICT 4-DIGIT PATTERN ENGINE
function patternEngine4(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let pattern4 = allResults.slice(0, 4).join("");
        let pattern3 = allResults.slice(0, 3).join("");

        let matchB = 0;
        let matchS = 0;

        for (let i = 1; i < allResults.length - 4; i++) {
            let pastPattern = allResults.slice(i, i + 4).join("");
            if (pattern4 === pastPattern) {
                let nextResult = allResults[i - 1];
                if (nextResult === "B") matchB++;
                if (nextResult === "S") matchS++;
            }
        }

        if (matchB === 0 && matchS === 0) {
            for (let i = 1; i < allResults.length - 3; i++) {
                let pastPattern = allResults.slice(i, i + 3).join("");
                if (pattern3 === pastPattern) {
                    let nextResult = allResults[i - 1];
                    if (nextResult === "B") matchB++;
                    if (nextResult === "S") matchS++;
                }
            }
        }

        let predResult = "BIG";
        if (matchS > matchB) {
            predResult = "SMALL";
        } else if (matchB > matchS) {
            predResult = "BIG";
        } else {
            predResult = allResults[0] === "B" ? "BIG" : "SMALL";
        }

        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let num1 = allNumbers[0];
        let num2 = allNumbers[1];

        let numFreqMap = {};

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
        console.error("4-Digit Engine Error:", e.message);
        return { predResult: "BIG", targetNumbers: [7, 8], numbersStr: "7, 8", colorStr: "🟢 GREEN" };
    }
}

async function fetchWinGoData() {
    if (isMaintenancePause) return;

    try {
        // Fast JSON fetch without render parameter
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
                    consecutiveLosses = 0;
                    maintenanceLevel = 1;

                    if (isNumberHit) {
                        cheerMsgText = "💥 **WINNER JACKPOT** 💥\nCONGRATULATIONS 💐🎉";
                    } else {
                        cheerMsgText = "🏆🎉 **BIG WINNER** 🎉🏆\nCONGRATULATIONS 💐🎉";
                    }
                } else {
                    totalLosses++;
                    consecutiveLosses++;
                    maintenanceLevel++;
                    cheerMsgText = "💪 **Cheer Up Mame! Next Time Mark It!** 👍\nBetter Luck Next Time!";

                    if (maintenanceLevel > 7) {
                        isMaintenancePause = true;
                        maintenanceLevel = 1;
                        consecutiveLosses = 0;

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

                    if (consecutiveLosses >= 2) {
                        isCoolingDown = true;
                        consecutiveLosses = 0;

                        let coolMsg = "⏳ **MARKET TREND PAUSE (1 MIN)** ⏳\n" +
                                      "━━━━━━━━━━━━━━━━━━━━━\n" +
                                      "⚠️ 2 Continuous Losses Detected!\n" +
                                      "🛑 Pausing 1 Minute for safer trend match...\n" +
                                      "━━━━━━━━━━━━━━━━━━━━━";

                        await bot.sendMessage(CHANNEL_ID, coolMsg, { parse_mode: 'Markdown' });

                        setTimeout(() => {
                            isCoolingDown = false;
                            console.log("[SYSTEM]: 1 Min Cooldown Completed.");
                        }, 60000);

                        return;
                    }
                }
            }

            if (isCoolingDown) return;

            if (nextPeriod !== lastSentPeriod) {
                let pred = patternEngine4(list);
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
                console.log("[SCRAPER SUCCESS] 4-Digit Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[SCRAPER ERROR]:', error.message);
    }
}

console.log("WinGo ScraperAPI 4-Digit Bot Active...");
setInterval(fetchWinGoData, 15000);
