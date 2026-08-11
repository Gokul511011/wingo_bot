const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

// Direct Configuration
const BOT_TOKEN = '8736025263:AAH5MuVDHWYtJ9x_-yYok7Y_Qj_Eez6s7EM';
const SCRAPINGANT_API_KEY = '376f50a96eb04accb756b4febc074f33';
const MAIN_CHANNEL = '-1002486828817';
const REPORT_CHANNEL = '-1003345976502';

const RAW_TARGET_URL =
    'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=500&pageNo=1';

const SCRAPINGANT_URL =
    `https://api.scrapingant.com/v2/general?x-api-key=${SCRAPINGANT_API_KEY}` +
    `&url=${encodeURIComponent(RAW_TARGET_URL)}` +
    `&proxy_country=in&browser=false`;

const REGISTER_LINK =
    'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedNumbers = [];
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let totalJackpots = 0;
let maintenanceLevel = 1;
let totalProfitLoss = 0;
let predictionCount = 0;
let maxLevelReached = 1;

let levelWins = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0
};

let levelJackpots = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0
};

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
    if (levelData[level]) {
        return levelData[level].val;
    }
    return Math.pow(3, level - 1);
}

function getNumberColor(num) {
    if ([2, 4, 6, 8].includes(num)) return "RED";
    if ([1, 3, 7, 9].includes(num)) return "GREEN";
    if (num === 0) return "RED / VIOLET";
    if (num === 5) return "GREEN / VIOLET";
    return "RED";
}

/*
=========================================================
MASTER GUIDE PATTERN ENGINE
=========================================================
*/
function masterGuidePatternEngine(history) {
    try {
        let allNumbers = history.map(x =>
            parseInt(x.number !== undefined ? x.number : x.result)
        );

        let allResults = allNumbers.map(n => (n >= 5 ? "BIG" : "SMALL"));

        if (allResults.length < 15) {
            return {
                predResult: "BIG",
                targetNumbers: [6, 8],
                numbersStr: "6, 8",
                colorStr: "🟢 GREEN",
                patternName: "Initial Stable Scan"
            };
        }

        let r = allResults;
        let predResult = "BIG";
        let patternName = "Standard Trend";

        let streak = 1;
        for (let i = 1; i < r.length; i++) {
            if (r[i] === r[0]) {
                streak++;
            } else {
                break;
            }
        }

        if (streak >= 5) {
            predResult = r[0] === "BIG" ? "SMALL" : "BIG";
            patternName = `Long Trend Break (${streak}x)`;
        } else if (streak >= 3) {
            predResult = r[0];
            patternName = `Quadra/Triple Trend (${streak}x Streak)`;
        } else if (r[0] === r[1] && r[2] === r[3] && r[0] !== r[2]) {
            predResult = r[2] === "BIG" ? "BIG" : "SMALL";
            patternName = "Double Trend Flow";
        } else if (r[0] !== r[1] && r[1] !== r[2] && r[2] !== r[3] && r[3] !== r[4]) {
            predResult = r[0] === "BIG" ? "SMALL" : "BIG";
            patternName = "Zig-Zag / Single Trend";
        } else if (r[0] === r[1] && r[1] !== r[2] && r[2] === r[3]) {
            predResult = r[2] === "BIG" ? "SMALL" : "BIG";
            patternName = "Correction Phase";
        } else {
            predResult = r[0] === "BIG" ? "SMALL" : "BIG";
            patternName = "Active Shifting Trend";
        }

        const lastNum = allNumbers[0];
        let numFrequency = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0 };
        let scanLimit = Math.min(history.length - 1, 300);

        for (let i = 0; i < scanLimit; i++) {
            let currN = parseInt(history[i].number !== undefined ? history[i].number : history[i].result);
            let nextN = parseInt(history[i + 1].number !== undefined ? history[i + 1].number : history[i + 1].result);
            if (currN === lastNum) {
                numFrequency[nextN]++;
            }
        }

        let candidates = [];
        for (let n = 0; n <= 9; n++) {
            let isBig = n >= 5;
            if ((predResult === "BIG" && isBig) || (predResult === "SMALL" && !isBig)) {
                candidates.push({ num: n, count: numFrequency[n] });
            }
        }

        candidates.sort((a, b) => b.count - a.count);

        let matchedNumbers = [];
        if (candidates.length >= 2) {
            matchedNumbers = [candidates[0].num, candidates[1].num];
        } else {
            matchedNumbers = predResult === "BIG" ? [6, 8] : [1, 3];
        }

        matchedNumbers.sort((a, b) => a - b);
        let numbersStr = matchedNumbers.join(", ");

        let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";
        if (matchedNumbers.includes(0)) {
            colorStr = "🔴 RED / 🟣 VIOLET";
        } else if (matchedNumbers.includes(5)) {
            colorStr = "🟢 GREEN / 🟣 VIOLET";
        }

        return { predResult, targetNumbers: matchedNumbers, numbersStr, colorStr, patternName };
    } catch (e) {
        return {
            predResult: "BIG",
            targetNumbers: [6, 8],
            numbersStr: "6, 8",
            colorStr: "🟢 GREEN",
            patternName: "Guide Fallback"
        };
    }
}

app.get('/', (req, res) => res.send('Master Guide Pattern Engine Active!'));

/*
=========================================================
FETCH WINGO DATA
=========================================================
*/
async function fetchWinGoData() {
    try {
        const response = await axios.get(SCRAPINGANT_URL, { timeout: 30000 });
        let rawContent = response.data.content || response.data;

        let parsedData = typeof rawContent === 'object'
            ? rawContent
            : JSON.parse(rawContent.match(/\{[\s\S]*\}/)[0]);

        let list = parsedData?.data?.list || parsedData?.list;
        if (!list || !Array.isArray(list) || list.length === 0) return;

        let lastItem = list[0];
        let actualPeriod = String(
            lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue || lastItem.issueCode || ""
        );

        if (!actualPeriod) return;

        let actualNum = parseInt(
            lastItem.number !== undefined ? lastItem.number : (lastItem.result !== undefined ? lastItem.result : 0)
        );

        let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
        let actualColor = getNumberColor(actualNum);
        let nextPeriod = String(BigInt(actualPeriod) + 1n);

        let currentSec = new Date().getSeconds();
        let secondsIntoPeriod = currentSec % 30;

        if (nextPeriod === lastSentPeriod) return;
        if (secondsIntoPeriod < 23 || secondsIntoPeriod > 24) return;

        let dynamicStatusMsg = "";

        if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
            let isResultHit = lastPredictedResult === actualResult;
            let isNumberHit = lastPredictedNumbers.includes(actualNum);
            let currentBetVal = getBetVal(maintenanceLevel);

            if (maintenanceLevel > maxLevelReached) {
                maxLevelReached = maintenanceLevel;
            }

            predictionCount++;

            if (isResultHit) {
                totalWins++;
                levelWins[maintenanceLevel] = (levelWins[maintenanceLevel] || 0) + 1;
                let winAmount = (currentBetVal * 0.98).toFixed(2);
                totalProfitLoss += parseFloat(winAmount);

                if (isNumberHit) {
                    totalJackpots++;
                    levelJackpots[maintenanceLevel] = (levelJackpots[maintenanceLevel] || 0) + 1;
                    dynamicStatusMsg = `🎉 **CONGRATULATIONS (LEVEL ${maintenanceLevel} ₹${winAmount} WIN + JK)** 🎉\n🏆 **${actualResult} (${actualNum}) JACKPOT HIT!**`;
                } else {
                    dynamicStatusMsg = `🎉 **CONGRATULATIONS (LEVEL ${maintenanceLevel} ₹${winAmount} WIN)** 🎉\n🏆 **${actualResult} (${actualNum}) WIN**`;
                }
                maintenanceLevel = 1;
            } else {
                totalLosses++;
                totalProfitLoss -= currentBetVal;

                if (maintenanceLevel >= 8) {
                    dynamicStatusMsg = `💔 **LOSS AT LEVEL 8: ${actualResult} (${actualNum})**\n🛡️ **SAFETY RESET: RESTARTING FROM LEVEL 1**`;
                    maintenanceLevel = 1;
                } else {
                    maintenanceLevel++;
                    dynamicStatusMsg = `💔 **LOSS: ${actualResult} (${actualNum} - ${actualColor})**\n➡️ **NEXT LEVEL (LEVEL ${maintenanceLevel})**`;
                }
            }

            if (predictionCount >= 60) {
                let profitSign = totalProfitLoss >= 0 ? "₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);
                let summaryMsg = 
                    "👑 **MASTER GUIDE BOT SUMMARY** 👑\n\n" +
                    "📊 **60 PREDICTIONS BATCH REPORT** 📊\n" +
                    "━━━━━━━━━━━━━━━━━━━━━\n" +
                    "🎯 **TOTAL PREDICTIONS:** 60\n" +
                    "🏆 **BIG / SMALL WINS:** " + totalWins + "\n" +
                    "💥 **JK WINS (JACKPOTS):** " + totalJackpots + "\n" +
                    "💔 **LOSSES:** " + totalLosses + "\n" +
                    "📈 **MAX LEVEL REACHED:** Level " + maxLevelReached + "\n" +
                    "💰 **TOTAL PROFIT:** **" + profitSign + "**\n" +
                    "━━━━━━━━━━━━━━━━━━━━━\n" +
                    "🔄 **Batch completed! Resetting stats for the next 60 rounds!**";

                await bot.sendMessage(MAIN_CHANNEL, summaryMsg, { parse_mode: 'Markdown' });
                await bot.sendMessage(REPORT_CHANNEL, summaryMsg, { parse_mode: 'Markdown' });

                predictionCount = 0;
                totalWins = 0;
                totalLosses = 0;
                totalJackpots = 0;
                totalProfitLoss = 0;
                maxLevelReached = 1;
                levelWins = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0 };
                levelJackpots = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0 };
            }
        }

        let pred = masterGuidePatternEngine(list);
        let currentBetName = levelData[maintenanceLevel]?.name || ("₹" + getBetVal(maintenanceLevel));
        let profitSign = totalProfitLoss >= 0 ? "₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);

        let msg =
            "🔥 **WINGO 30S MASTER GUIDE ENGINE** 🔥\n" +
            "━━━━━━━━━━━━━━━━━━━━━\n" +
            "⏰ **ADVANCE:** `6–7 SEC`\n" +
            "📌 **PERIOD:** `" + nextPeriod + "`\n" +
            "🔍 **DETECTED PATTERN:** `" + pred.patternName + "`\n" +
            "🎲 **BET:** **" + pred.predResult + "**\n" +
            "🔢 **PRED NO:** `" + pred.numbersStr + "`\n" +
            "🎨 **COLOUR:** " + pred.colorStr + "\n" +
            "💰 **BET LEVEL AMT:** **LEVEL " + maintenanceLevel + " (" + currentBetName + ")** [MAX: L8]\n" +
            "━━━━━━━━━━━━━━━━━━━━━\n";

        if (dynamicStatusMsg !== "") {
            msg += dynamicStatusMsg + "\n━━━━━━━━━━━━━━━━━━━━━\n";
        }

        msg +=
            "🔢 **PROGRESS:** " + predictionCount + " / 60\n" +
            "🏆 **WINS:** " + totalWins + " | 💥 **JK WINS:** " + totalJackpots + " | 💔 **LOSS:** " + totalLosses + "\n" +
            "📊 **TOTAL PROFIT:** **" + profitSign + "**\n" +
            "━━━━━━━━━━━━━━━━━━━━━\n" +
            "🎯 **LIVE LEVEL WINS & JK (L1 - L8):**\n" +
            "🔹 **LEVEL 1:** " + levelWins[1] + " WINS (💥 " + levelJackpots[1] + " JK)\n" +
            "🔹 **LEVEL 2:** " + levelWins[2] + " WINS (💥 " + levelJackpots[2] + " JK)\n" +
            "🔹 **LEVEL 3:** " + levelWins[3] + " WINS (💥 " + levelJackpots[3] + " JK)\n" +
            "🔹 **LEVEL 4:** " + levelWins[4] + " WINS (💥 " + levelJackpots[4] + " JK)\n" +
            "🔹 **LEVEL 5:** " + levelWins[5] + " WINS (💥 " + levelJackpots[5] + " JK)\n" +
            "🔹 **LEVEL 6:** " + levelWins[6] + " WINS (💥 " + levelJackpots[6] + " JK)\n" +
            "🔹 **LEVEL 7:** " + levelWins[7] + " WINS (💥 " + levelJackpots[7] + " JK)\n" +
            "🔹 **LEVEL 8:** " + levelWins[8] + " WINS (💥 " + levelJackpots[8] + " JK)\n" +
            "━━━━━━━━━━━━━━━━━━━━━\n\n" +
            "🔗 **Register Link:**\n" + REGISTER_LINK;

        await bot.sendMessage(MAIN_CHANNEL, msg, { parse_mode: 'Markdown' });

        lastSentPeriod = nextPeriod;
        lastPredictedPeriod = nextPeriod;
        lastPredictedResult = pred.predResult;
        lastPredictedNumbers = pred.targetNumbers;

    } catch (e) {
        console.error("Error:", e.message);
    }
}

async function startContinuousLoop() {
    while (true) {
        await fetchWinGoData();
        await new Promise(r => setTimeout(r, 1000));
    }
}

app.listen(PORT, '0.0.0.0', () => {
    console.log("Master Guide Bot Active on port " + PORT);
    startContinuousLoop();
});
