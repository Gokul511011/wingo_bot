const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const MAIN_CHANNEL = '-1002486828817';
const REPORT_CHANNEL = '-1003345976502';

const RAW_TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=500&pageNo=1';
const SCRAPINGANT_API_KEY = 'd717a6d4020b465aac8d0eed35459624'; 
const SCRAPINGANT_URL = `https://api.scrapingant.com/v2/general?x-api-key=${SCRAPINGANT_API_KEY}&url=${encodeURIComponent(RAW_TARGET_URL)}&proxy_country=in&browser=false`;
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedNumbers = [];
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let totalJackpots = 0;
let maintenanceLevel = 1; 
let totalProfitLoss = 0;
let predictionCount = 0;
let maxLevelReached = 1;

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

// Pure 500 History Transition Number Prediction Engine
function pureNumberPredictionEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        if (allNumbers.length < 10) {
            return { targetNumbers: [3, 7], numbersStr: "3, 7", colorStr: "🟢 GREEN", transitionInfo: "Standard Start" };
        }

        const lastNum = allNumbers[0];
        
        // Scan up to 500 history to see which number followed lastNum most frequently
        let numFrequency = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0};
        let scanLimit = Math.min(history.length - 1, 500);

        for (let i = 0; i < scanLimit; i++) {
            let currN = parseInt(history[i].number !== undefined ? history[i].number : history[i].result);
            let nextN = parseInt(history[i+1].number !== undefined ? history[i+1].number : history[i+1].result);
            if (currN === lastNum) {
                numFrequency[nextN]++;
            }
        }

        let sortedCandidates = [];
        for (let n = 0; n <= 9; n++) {
            sortedCandidates.push({ num: n, count: numFrequency[n] });
        }

        // Sort by highest transition count
        sortedCandidates.sort((a, b) => b.count - a.count);

        // Pick top 2 exact numbers
        let matchedNumbers = [sortedCandidates[0].num, sortedCandidates[1].num];
        matchedNumbers.sort((a, b) => a - b);
        let numbersStr = matchedNumbers.join(", ");
        
        // Determine color based on primary predicted number
        let primaryNum = matchedNumbers[0];
        let colorStr = getNumberColor(primaryNum);
        let transitionInfo = `After [${lastNum}] -> [${matchedNumbers.join(', ')}] Lead`;

        return { targetNumbers: matchedNumbers, numbersStr, colorStr, transitionInfo };
    } catch (e) {
        return { targetNumbers: [2, 8], numbersStr: "2, 8", colorStr: "🔴 RED", transitionInfo: "Fallback Lead" };
    }
}

app.get('/', (req, res) => res.send('WinGo 30S Pure Number Prediction Engine Active!'));

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
            let isNumberHit = lastPredictedNumbers.includes(actualNum);
            let currentBetVal = getBetVal(maintenanceLevel);

            if (maintenanceLevel > maxLevelReached) maxLevelReached = maintenanceLevel;
            predictionCount++;

            if (isNumberHit) {
                totalWins++;
                totalJackpots++;
                if (levelWins[maintenanceLevel] !== undefined) levelWins[maintenanceLevel]++;
                else levelWins[maintenanceLevel] = 1;

                // Number bet payout calculation (Multiplier standard logic)
                let winAmount = (currentBetVal * 8.5).toFixed(2);
                totalProfitLoss += parseFloat(winAmount);

                dynamicStatusMsg = `🎉 **JACKPOT NUMBER HIT! (LEVEL ${maintenanceLevel})** 🎉\n🏆 **ACTUAL NUMBER: ${actualNum} (${actualColor})** | **WIN: +₹${winAmount}**`;
                maintenanceLevel = 1; 
            } else {
                totalLosses++;
                totalProfitLoss -= currentBetVal;
                
                if (maintenanceLevel >= 8) {
                    dynamicStatusMsg = `💔 **LOSS AT LEVEL 8: ACTUAL (${actualNum})**\n🛡️ **SAFETY RESET: RESTARTING FROM LEVEL 1**`;
                    maintenanceLevel = 1;
                } else {
                    maintenanceLevel++;
                    dynamicStatusMsg = `💔 **LOSS: ACTUAL (${actualNum} - ${actualColor})**\n➡️ **NEXT LEVEL (LEVEL ${maintenanceLevel})**`;
                }
            }

            if (predictionCount >= 60) {
                let profitSign = totalProfitLoss >= 0 ? "₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);
                let summaryMsg = "👑 **PURE NUMBER PREDICTION MASTER** 👑\n\n" +
                                 "📊 **60 ROUNDS NUMBER SUMMARY** 📊\n" +
                                 "━━━━━━━━━━━━━━━━━━━━━\n" +
                                 "🎯 **TOTAL ROUNDS:** 60\n" +
                                 "🏆 **NUMBER WINS (JACKPOTS):** " + totalJackpots + "\n" +
                                 "💔 **LOSSES:** " + totalLosses + "\n" +
                                 "📈 **MAX LEVEL REACHED:** Level " + maxLevelReached + "\n" +
                                 "💰 **TOTAL PROFIT:** **" + profitSign + "**\n" +
                                 "━━━━━━━━━━━━━━━━━━━━━\n" +
                                 "🔄 **Resetting stats for the next batch!**";

                await bot.sendMessage(MAIN_CHANNEL, summaryMsg, { parse_mode: 'Markdown' });
                await bot.sendMessage(REPORT_CHANNEL, summaryMsg, { parse_mode: 'Markdown' });

                predictionCount = 0;
                totalWins = 0;
                totalLosses = 0;
                totalJackpots = 0;
                totalProfitLoss = 0;
                maxLevelReached = 1;
                levelWins = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
            }
        }

        let pred = pureNumberPredictionEngine(list);
        let currentBetName = levelData[maintenanceLevel]?.name || ("₹" + getBetVal(maintenanceLevel));
        let profitSign = totalProfitLoss >= 0 ? "₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);

        let msg = "🎯 **WINGO 30S NUMBER PREDICTION** 🎯\n" +
                  "━━━━━━━━━━━━━━━━━━━━━\n" +
                  "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                  "📊 **LOGIC:** `" + pred.transitionInfo + "`\n" +
                  "🔢 **TARGET NUMBERS:** `" + pred.numbersStr + "`\n" +
                  "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                  "💰 **BET LEVEL AMT:** **LEVEL " + maintenanceLevel + " (" + currentBetName + ")** [MAX: L8]\n" +
                  "━━━━━━━━━━━━━━━━━━━━━\n";

        if (dynamicStatusMsg !== "") {
            msg += dynamicStatusMsg + "\n━━━━━━━━━━━━━━━━━━━━━\n";
        }

        msg += "🔢 **PROGRESS:** " + predictionCount + " / 60\n" +
               "🏆 **WINS:** " + totalJackpots + " | 💔 **LOSS:** " + totalLosses + "\n" +
               "📊 **TOTAL PROFIT:** **" + profitSign + "**\n" +
               "━━━━━━━━━━━━━━━━━━━━━\n" +
               "🎯 **LEVEL WINS (L1 - L8):**\n" +
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
    console.log("Pure Number Prediction Engine Active on port " + PORT); 
    startContinuousLoop(); 
});
