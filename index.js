const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render Uptime
const app = express();
const PORT = process.env.PORT || 10000;

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPINGANT_API_KEY = '2a3f73c602be4a9c8abd9ae09cb196a9'; 

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=1000&pageNo=1';
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

app.get('/', (req, res) => res.send('WinGo 30S Continuous Engine Active!'));

app.listen(PORT, '0.0.0.0', async () => {
    console.log("Server running on port " + PORT);
    try {
        await bot.sendMessage(CHANNEL_ID, "🚀 **WinGo Bot Live & Running Non-Stop...**", { parse_mode: 'Markdown' });
    } catch (e) {
        console.error("Startup Notification Error:", e.message);
    }
});

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedNumbers = [];
let lastPredictedColor = "";
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let totalJackpots = 0;
let maintenanceLevel = 1;
let totalProfitLoss = 0;

let predictionCount = 0;
let maxLevelReached = 1;
let prediction60History = [];

const levelData = {
    1: { name: "₹1", val: 1 },
    2: { name: "₹3", val: 3 },
    3: { name: "₹7", val: 7 },
    4: { name: "₹20", val: 20 },
    5: { name: "₹50", val: 50 },
    6: { name: "₹150", val: 150 },
    7: { name: "₹450", val: 450 },
    8: { name: "₹1350", val: 1350 }
};

function getBetVal(level) {
    if (levelData[level]) return levelData[level].val;
    return Math.pow(3, level - 1);
}

function getNumberColor(num) {
    if ([2, 4, 6, 8].includes(num)) return "RED";
    if ([1, 3, 7, 9].includes(num)) return "GREEN";
    if (num === 0) return "RED / VIOLET";
    if (num === 5) return "GREEN / VIOLET";
    return "RED";
}

function invertPattern(str) {
    return str.split('').map(char => char === 'B' ? 'S' : (char === 'S' ? 'B' : char)).join('');
}

// Updated Pattern Engine: Strict 2 Target Numbers Logic
function deepHistoryPatternEngine(history, currentLevel) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let predResult = "";

        if (currentLevel >= 5) {
            let lastItem = allResults[0];
            predResult = lastItem === "B" ? "SMALL" : "BIG";
        } 
        else if (allResults[0] === allResults[1] && allResults[1] === allResults[2]) {
            predResult = allResults[0] === "B" ? "BIG" : "SMALL";
        }
        else if (allResults[0] !== allResults[1] && allResults[1] !== allResults[2] && allResults[2] !== allResults[3]) {
            predResult = allResults[0] === "B" ? "SMALL" : "BIG";
        }
        else if (allResults[0] === allResults[1] && allResults[2] === allResults[3] && allResults[0] !== allResults[2]) {
            predResult = allResults[0] === "B" ? "SMALL" : "BIG";
        }
        else {
            let scoreB = 0;
            let scoreS = 0;
            let seq5 = allResults.slice(0, 5).join("");
            let mirrorSeq5 = invertPattern(seq5);

            for (let i = 1; i < Math.min(100, allResults.length - 6); i++) {
                let histSeq5 = allResults.slice(i, i + 5).join("");
                let nextItem = allResults[i - 1];
                let weight = i < 15 ? 5 : (i < 40 ? 2 : 1);

                if (histSeq5 === seq5) {
                    if (nextItem === "B") scoreB += (2 * weight);
                    if (nextItem === "S") scoreS += (2 * weight);
                }
                if (histSeq5 === mirrorSeq5) {
                    if (nextItem === "S") scoreB += (2 * weight);
                    if (nextItem === "B") scoreS += (2 * weight);
                }
            }

            if (scoreB > scoreS) predResult = "BIG";
            else if (scoreS > scoreB) predResult = "SMALL";
            else predResult = allResults[0] === "B" ? "BIG" : "SMALL"; 
        }

        // Updated Target Number Selection Strategy
        const lastNum = allNumbers[0] !== undefined ? allNumbers[0] : 5;
        let matchedNumbers = [];

        if (predResult === "BIG") {
            if (lastNum === 5 || lastNum === 0) matchedNumbers = [7, 9];
            else if (lastNum === 6 || lastNum === 1) matchedNumbers = [6, 8];
            else if (lastNum === 7 || lastNum === 2) matchedNumbers = [7, 9];
            else matchedNumbers = [5, 8];
        } else {
            if (lastNum === 0 || lastNum === 5) matchedNumbers = [1, 3];
            else if (lastNum === 1 || lastNum === 6) matchedNumbers = [0, 2];
            else if (lastNum === 2 || lastNum === 7) matchedNumbers = [1, 3];
            else matchedNumbers = [0, 4];
        }

        let numbersStr = matchedNumbers.join(", ");
        
        let mainColor = predResult === "BIG" ? "GREEN" : "RED";
        let colorStr = mainColor === "GREEN" ? "🟢 GREEN" : "🔴 RED";
        if (matchedNumbers.includes(0)) {
            colorStr = "🔴 RED / 🟣 VIOLET";
        } else if (matchedNumbers.includes(5)) {
            colorStr = "🟢 GREEN / 🟣 VIOLET";
        }

        return { predResult, targetNumbers: matchedNumbers, numbersStr, colorStr, mainColor };

    } catch (e) {
        console.error("Pattern Engine Error:", e.message);
        return { predResult: "BIG", targetNumbers: [7, 9], numbersStr: "7, 9", colorStr: "🟢 GREEN", mainColor: "GREEN" };
    }
}

let isFetching = false;

async function fetchWinGoData() {
    if (isFetching) return;
    isFetching = true;

    try {
        let rawContent = null;

        try {
            const directRes = await axios.get(TARGET_URL, {
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': 'https://www.rajastake7.com/'
                }
            });
            rawContent = directRes.data;
        } catch (err) {
            try {
                const scraperUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(TARGET_URL)}&x-api-key=${SCRAPINGANT_API_KEY}&browser=false&return_page_source=false`;
                const response = await axios.get(scraperUrl, { timeout: 8000 });
                rawContent = response.data;
            } catch (e) {}
        }

        if (typeof rawContent === 'string') {
            try { rawContent = JSON.parse(rawContent); } catch (e) {}
        }

        let list = rawContent?.data?.list || rawContent?.list || (Array.isArray(rawContent) ? rawContent : null);

        if (!list || !Array.isArray(list) || list.length === 0) {
            isFetching = false;
            return;
        }

        let lastItem = list[0];
        let actualNum = parseInt(lastItem.number !== undefined ? lastItem.number : lastItem.result);
        let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
        let actualColor = getNumberColor(actualNum);
        let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue);
        
        let nextPeriod = String(BigInt(actualPeriod) + 1n);
        let dynamicStatusMsg = "";

        if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
            let isResultHit = (lastPredictedResult === actualResult);
            let isNumberHit = lastPredictedNumbers.includes(actualNum);
            let isColorHit = actualColor.includes(lastPredictedColor);

            let currentLevelExecuted = maintenanceLevel;
            let currentBetVal = getBetVal(currentLevelExecuted);

            if (currentLevelExecuted > maxLevelReached) {
                maxLevelReached = currentLevelExecuted;
            }

            predictionCount++;

            if (isResultHit) {
                totalWins++;

                let winAmount = currentBetVal * 0.98;
                totalProfitLoss += winAmount;

                if (isNumberHit && isColorHit) {
                    totalJackpots++;
                    dynamicStatusMsg = "🏆 **" + actualResult + " (" + actualNum + ") " + actualColor + " JACKPOT WINNERS** 🏆";
                } 
                else if (isNumberHit) {
                    totalJackpots++;
                    dynamicStatusMsg = "🏆 **" + actualResult + " (" + actualNum + ") JACKPOT WINNER** 🏆";
                } 
                else if (isColorHit) {
                    dynamicStatusMsg = "🏆 **" + actualResult + " (" + actualNum + ") " + actualColor + " WINNER CONGRATULATIONS** 🏆";
                } 
                else {
                    dynamicStatusMsg = "🏆 **" + actualResult + " (" + actualNum + ") WIN** 🏆";
                }

                prediction60History.unshift({ period: actualPeriod, status: "WIN", level: currentLevelExecuted });
                maintenanceLevel = 1; 

            } else {
                totalLosses++;
                totalProfitLoss -= currentBetVal;

                dynamicStatusMsg = "💔 **LOSS: " + actualResult + " (" + actualNum + " - " + actualColor + ")**";

                prediction60History.unshift({ period: actualPeriod, status: "LOSS", level: currentLevelExecuted });
                maintenanceLevel++; 
            }

            // 60 predictions batch report
            if (predictionCount >= 60) {
                let profitSign = totalProfitLoss >= 0 ? "+₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);
                
                let summaryMsg = "📊 **60 PREDICTIONS BATCH SUMMARY REPORT** 📊\n" +
                                 "━━━━━━━━━━━━━━━━━━━━━\n" +
                                 "🎯 **TOTAL PREDICTIONS:** 60\n" +
                                 "🏆 **TOTAL WINS:** " + totalWins + "\n" +
                                 "💥 **TOTAL JACKPOTS:** " + totalJackpots + "\n" +
                                 "💔 **TOTAL LOSSES:** " + totalLosses + "\n" +
                                 "📈 **MAX LEVEL REACHED:** Level " + maxLevelReached + "\n" +
                                 "💰 **NET PROFIT / LOSS:** **" + profitSign + "**\n" +
                                 "━━━━━━━━━━━━━━━━━━━━━\n" +
                                 "📝 **RECENT HISTORY SUMMARY (LAST 10):**\n";

                let recent10 = prediction60History.slice(0, 10);
                recent10.forEach(item => {
                    let icon = item.status === "WIN" ? "✅" : "❌";
                    summaryMsg += `${icon} Period: \`${item.period}\` - ${item.status} (Level ${item.level})\n`;
                });

                summaryMsg += "━━━━━━━━━━━━━━━━━━━━━\n🔄 **Batch completed! Resetting stats for the next 60 rounds non-stop!**";

                await bot.sendMessage(CHANNEL_ID, summaryMsg, { parse_mode: 'Markdown' });

                predictionCount = 0;
                totalWins = 0;
                totalLosses = 0;
                totalJackpots = 0;
                totalProfitLoss = 0;
                maxLevelReached = 1;
                prediction60History = [];
            }
        }

        if (nextPeriod !== lastSentPeriod) {
            let pred = deepHistoryPatternEngine(list, maintenanceLevel);
            
            let activeLevel = maintenanceLevel;
            let currentBetName = levelData[activeLevel]?.name || ("₹" + getBetVal(activeLevel));

            let profitSign = totalProfitLoss >= 0 ? "+₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);

            let msg = "👑 **KING PREDICTION**\n" +
                      "⚡ **WinGo 30S (Non-Stop Predictions)** ⚡\n" +
                      "━━━━━━━━━━━━━━━━━━━━━\n" +
                      "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                      "🎯 **TARGET:** **" + pred.predResult + "**\n" +
                      "🔢 **NUMBERS:** `" + pred.numbersStr + "`\n" +
                      "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                      "💰 **BET AMOUNT:** **" + currentBetName + " (Level " + activeLevel + ")**\n" +
                      "━━━━━━━━━━━━━━━━━━━━━\n";

            if (dynamicStatusMsg !== "") {
                msg += dynamicStatusMsg + "\n━━━━━━━━━━━━━━━━━━━━━\n";
            }

            msg += "🔢 **PROGRESS:** " + predictionCount + " / 60\n" +
                   "🏆 **WINS:** " + totalWins + " | 💥 **JACKPOTS:** " + totalJackpots + " | 💔 **LOSSES:** " + totalLosses + "\n" +
                   "📊 **TOTAL PROFIT / LOSS:** **" + profitSign + "**\n" +
                   "━━━━━━━━━━━━━━━━━━━━━\n\n" +
                   "🔗 **Register Link:**\n" + REGISTER_LINK;

            await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });

            lastSentPeriod = nextPeriod;
            lastPredictedPeriod = nextPeriod;
            lastPredictedResult = pred.predResult;
            lastPredictedNumbers = pred.targetNumbers;
            lastPredictedColor = pred.mainColor;
            console.log("[CONTINUOUS] Sent Period: " + nextPeriod + " (" + predictionCount + "/60)");
        }
    } catch (error) {
        console.error('[FETCH ERROR]:', error.message);
    } finally {
        isFetching = false;
    }
}

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));

setInterval(fetchWinGoData, 3000);
