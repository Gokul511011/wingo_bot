const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const MAIN_CHANNEL = '-1002486828817';
const REPORT_CHANNEL = '-1003345976502';

// 500 History check kkupageSize 500 nu fix panliyachu
const RAW_TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=500&pageNo=1';
const SCRAPINGANT_API_KEY = 'd717a6d4020b465aac8d0eed35459624'; 
const SCRAPINGANT_URL = `https://api.scrapingant.com/v2/general?x-api-key=${SCRAPINGANT_API_KEY}&url=${encodeURIComponent(RAW_TARGET_URL)}&proxy_country=in&browser=false`;
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

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
let consecutiveLosses = 0; // Track consecutive losses to detect pattern break

let levelWins = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };

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

// Normal Trend & 500 History Smart Number Engine with Break Detection
function normalTrendAndNumberEngine(history, consecutiveLossesCount) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "BIG" : "SMALL");

        if (allResults.length < 10) {
            return { predResult: "BIG", targetNumbers: [6, 8], numbersStr: "6, 8", colorStr: "🟢 GREEN", statusText: "Normal Trend" };
        }

        let r1 = allResults[0];
        let r2 = allResults[1];
        let r3 = allResults[2];

        let predResult = "BIG";
        let statusText = "Normal Follow Trend";

        // If 2 consecutive losses occur, pattern is broken -> Reverse/Adapt strategy
        if (consecutiveLossesCount >= 2) {
            statusText = "Pattern Broken (Reversed)";
            predResult = (r1 === "BIG") ? "SMALL" : "BIG";
        } else {
            // Standard Normal Trend (Big if last is big, small if last is small, with basic alternation check)
            if (r1 === r2 && r2 === r3) {
                predResult = r1; // Continue streak normally
                statusText = "Streak Trend";
            } else {
                predResult = r1; // Normal direct follow
                statusText = "Direct Trend";
            }
        }

        const lastNum = allNumbers[0] !== undefined ? allNumbers[0] : 5;
        
        // Scan up to 500 history for precise number transition frequency
        let numFrequency = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0};
        let scanLimit = Math.min(history.length - 1, 500);

        for (let i = 0; i < scanLimit; i++) {
            let currN = parseInt(history[i].number !== undefined ? history[i].number : history[i].result);
            let nextN = parseInt(history[i+1].number !== undefined ? history[i+1].number : history[i+1].result);
            if (currN === lastNum) {
                numFrequency[nextN]++;
            }
        }

        let candidateNumbers = [];
        for (let n = 0; n <= 9; n++) {
            let isBig = n >= 5;
            if ((predResult === "BIG" && isBig) || (predResult === "SMALL" && !isBig)) {
                candidateNumbers.push({ num: n, count: numFrequency[n] });
            }
        }

        // Sort by frequency to get top 2 precise numbers based on 500 history
        candidateNumbers.sort((a, b) => b.count - a.count);

        let matchedNumbers = [];
        if (candidateNumbers.length >= 2) {
            matchedNumbers = [candidateNumbers[0].num, candidateNumbers[1].num];
        } else {
            matchedNumbers = predResult === "BIG" ? [6, 8] : [1, 3];
        }

        matchedNumbers.sort((a, b) => a - b);
        let numbersStr = matchedNumbers.join(", ");
        
        let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";
        if (matchedNumbers.includes(0)) colorStr = "🔴 RED / 🟣 VIOLET";
        else if (matchedNumbers.includes(5)) colorStr = "🟢 GREEN / 🟣 VIOLET";
        else if (matchedNumbers.some(n => [2, 4, 6, 8].includes(n))) {
            colorStr = predResult === "BIG" ? "🟢 GREEN / 🔴 RED" : "🔴 RED";
        }

        return { predResult, targetNumbers: matchedNumbers, numbersStr, colorStr, statusText };
    } catch (e) {
        return { predResult: "BIG", targetNumbers: [6, 8], numbersStr: "6, 8", colorStr: "🟢 GREEN", statusText: "Fallback" };
    }
}

app.get('/', (req, res) => res.send('WinGo 30S Normal Trend & 500 History Number Engine Active!'));

async function fetchWinGoData() {
    try {
        const response = await axios.get(SCRAPINGANT_URL, { timeout: 30000 });
        let rawContent = response.data.content || response.data;
        let parsedData = typeof rawContent === 'object' ? rawContent : JSON.parse(rawContent.match(/\{[\s\S]*\}/)[0]);
        let list = parsedData?.data?.list || parsedData?.list;

        if (!list || !Array.isArray(list) || list.length === 0) return;

        let lastItem = list[0];
        let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue || lastItem.issueCode || "");
        if (!actualPeriod) return; 

        let actualNum = parseInt(lastItem.number !== undefined ? lastItem.number : (lastItem.result !== undefined ? lastItem.result : 0));
        let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
        let actualColor = getNumberColor(actualNum);
        
        let nextPeriod = String(BigInt(actualPeriod) + 1n);

        let currentSec = new Date().getSeconds();
        let secondsIntoPeriod = currentSec % 30;
        
        if (nextPeriod === lastSentPeriod) return; 

        if (secondsIntoPeriod < 18 && secondsIntoPeriod > 3) {
            return;
        }

        let dynamicStatusMsg = "";

        if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
            let isResultHit = (lastPredictedResult === actualResult);
            let isNumberHit = lastPredictedNumbers.includes(actualNum);
            let currentBetVal = getBetVal(maintenanceLevel);

            if (maintenanceLevel > maxLevelReached) maxLevelReached = maintenanceLevel;
            predictionCount++;

            if (isResultHit) {
                totalWins++;
                consecutiveLosses = 0; // Reset loss count on win
                if (levelWins[maintenanceLevel] !== undefined) levelWins[maintenanceLevel]++;
                else levelWins[maintenanceLevel] = 1;

                let winAmount = (currentBetVal * 0.98).toFixed(2);
                totalProfitLoss += parseFloat(winAmount);

                if (isNumberHit) {
                    totalJackpots++;
                    dynamicStatusMsg = `🎉 **CONGRATULATIONS (LEVEL ${maintenanceLevel} (₹${winAmount} JACKPOT WIN))** 🎉\n🏆 **${actualResult} (${actualNum}) JACKPOT HIT**`;
                } else {
                    dynamicStatusMsg = `🎉 **CONGRATULATIONS (LEVEL ${maintenanceLevel} (₹${winAmount} WIN))** 🎉\n🏆 **${actualResult} (${actualNum}) WIN**`;
                }
                maintenanceLevel = 1; 
            } else {
                totalLosses++;
                consecutiveLosses++; // Increment consecutive loss
                totalProfitLoss -= currentBetVal;
                
                if (maintenanceLevel >= 8) {
                    dynamicStatusMsg = `💔 **LOSS AT LEVEL 8: ${actualResult} (${actualNum})**\n🛡️ **SAFETY RESET: RESTARTING FROM LEVEL 1**`;
                    maintenanceLevel = 1;
                    consecutiveLosses = 0;
                } else {
                    maintenanceLevel++;
                    dynamicStatusMsg = `💔 **LOSS: ${actualResult} (${actualNum} - ${actualColor})**\n➡️ **NEXT LEVEL (LEVEL ${maintenanceLevel})**`;
                }
            }

            if (predictionCount >= 60) {
                let profitSign = totalProfitLoss >= 0 ? "₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);
                let summaryMsg = "👑 **NORMAL TREND & NUMBER MASTER** 👑\n\n" +
                                 "📊 **60 PREDICTIONS BATCH SUMMARY REPORT** 📊\n" +
                                 "━━━━━━━━━━━━━━━━━━━━━\n" +
                                 "🎯 **TOTAL PREDICTIONS:** 60\n" +
                                 "🏆 **BIG / SMALL WINS:** " + totalWins + "\n" +
                                 "💥 **JACKPOT WINS:** " + totalJackpots + "\n" +
                                 "💔 **LOSSES:** " + totalLosses + "\n" +
                                 "📈 **MAX LEVEL REACHED:** Level " + maxLevelReached + "\n" +
                                 "💰 **TOTAL PROFIT:** **" + profitSign + "**\n" +
                                 "━━━━━━━━━━━━━━━━━━━━━\n" +
                                 "🔄 **Batch completed! Resetting stats for the next 60 rounds non-stop!**";

                await bot.sendMessage(MAIN_CHANNEL, summaryMsg, { parse_mode: 'Markdown' });
                await bot.sendMessage(REPORT_CHANNEL, summaryMsg, { parse_mode: 'Markdown' });

                predictionCount = 0;
                totalWins = 0;
                totalLosses = 0;
                totalJackpots = 0;
                totalProfitLoss = 0;
                maxLevelReached = 1;
                consecutiveLosses = 0;
                levelWins = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
            }
        }

        let pred = normalTrendAndNumberEngine(list, consecutiveLosses);
        let currentBetName = levelData[maintenanceLevel]?.name || ("₹" + getBetVal(maintenanceLevel));
        let profitSign = totalProfitLoss >= 0 ? "₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);

        let msg = "🔥 **WINGO 30S NORMAL PREDICTION** 🔥\n" +
                  "━━━━━━━━━━━━━━━━━━━━━\n" +
                  "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                  "🧩 **STATUS:** `" + pred.statusText + "`\n" +
                  "🎲 **BET:** **" + pred.predResult + "**\n" +
                  "🔢 **PRED NO:** `" + pred.numbersStr + "`\n" +
                  "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                  "💰 **BET LEVEL AMT:** **LEVEL " + maintenanceLevel + " (" + currentBetName + ")** [MAX: L8]\n" +
                  "━━━━━━━━━━━━━━━━━━━━━\n";

        if (dynamicStatusMsg !== "") {
            msg += dynamicStatusMsg + "\n━━━━━━━━━━━━━━━━━━━━━\n";
        }

        msg += "🔢 **PROGRESS:** " + predictionCount + " / 60\n" +
               "🏆 **B/S WINS:** " + totalWins + " | 💥 **JK:** " + totalJackpots + " | 💔 **LOSS:** " + totalLosses + "\n" +
               "📊 **TOTAL PROFIT:** **" + profitSign + "**\n" +
               "━━━━━━━━━━━━━━━━━━━━━\n" +
               "🎯 **LIVE LEVEL WINS (L1 - L8):**\n" +
               "🔹 **LEVEL 1:** " + levelWins[1] + " WINS\n" +
               "🔹 **LEVEL 2:** " + levelWins[2] + " WINS\n" +
               "🔹 **LEVEL 3:** " + levelWins[3] + " WINS\n" +
               "🔹 **LEVEL 4:** " + levelWins[4] + " WINS\n" +
               "🔹 **LEVEL 5:** " + levelWins[5] + " WINS\n" +
               "🔹 **LEVEL 6:** " + levelWins[6] + " WINS\n" +
               "🔹 **LEVEL 7:** " + levelWins[7] + " WINS\n" +
               "🔹 **LEVEL 8:** " + levelWins[8] + " WINS\n" +
               "━━━━━━━━━━━━━━━━━━━━━\n\n" +
               "🔗 **Register Link:**\n" + REGISTER_LINK;

        await bot.sendMessage(MAIN_CHANNEL, msg, { parse_mode: 'Markdown' });

        lastSentPeriod = nextPeriod;
        lastPredictedPeriod = nextPeriod;
        lastPredictedResult = pred.predResult;
        lastPredictedNumbers = pred.targetNumbers;

    } catch (e) { console.error("Error:", e.message); }
}

async function startContinuousLoop() { 
    while (true) { 
        await fetchWinGoData(); 
        await new Promise(r => setTimeout(r, 3000)); 
    } 
}

app.listen(PORT, '0.0.0.0', () => { 
    console.log("Normal Trend & Number Engine Bot Active on port " + PORT); 
    startContinuousLoop(); 
});
