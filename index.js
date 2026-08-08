const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const MAIN_CHANNEL = '-1002486828817';
const REPORT_CHANNEL = '-1003345976502';

const RAW_TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=1000&pageNo=1';
const SCRAPINGANT_API_KEY = 'd717a6d4020b465aac8d0eed35459624'; 
const SCRAPINGANT_URL = `https://api.scrapingant.com/v2/general?x-api-key=${SCRAPINGANT_API_KEY}&url=${encodeURIComponent(RAW_TARGET_URL)}&proxy_country=in&browser=false`;
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// வேரியபிள்கள் இங்கே இருக்க வேண்டும்
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
let levelWins = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };

const levelData = {
    1: { name: "₹1", val: 1 }, 2: { name: "₹3", val: 3 }, 3: { name: "₹7", val: 7 }, 4: { name: "₹20", val: 20 },
    5: { name: "₹50", val: 50 }, 6: { name: "₹150", val: 150 }, 7: { name: "₹450", val: 450 }, 8: { name: "₹1350", val: 1350 }
};

function getBetVal(level) { return levelData[level] ? levelData[level].val : Math.pow(3, level - 1); }
function getNumberColor(num) {
    if ([2, 4, 6, 8].includes(num)) return "RED";
    if ([1, 3, 7, 9].includes(num)) return "GREEN";
    if (num === 0) return "RED / VIOLET";
    if (num === 5) return "GREEN / VIOLET";
    return "RED";
}

// ... (deepHistoryPatternEngine அப்படியே இருக்கட்டும்) ...
function deepHistoryPatternEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "BIG" : "SMALL");
        let r1 = allResults[0], r2 = allResults[1], r3 = allResults[2], r4 = allResults[3];
        let predResult = (r1 !== r2 && r2 !== r3 && r3 !== r4) ? (r1 === "BIG" ? "SMALL" : "BIG") : r1;
        const lastNum = allNumbers[0] !== undefined ? allNumbers[0] : 5;
        let matchedNumbers = predResult === "BIG" ? ([5, 0].includes(lastNum) ? [6, 8] : [6, 1].includes(lastNum) ? [7, 9] : [7, 2].includes(lastNum) ? [5, 8] : [8, 3].includes(lastNum) ? [6, 9] : [7, 8]) : ([0, 5].includes(lastNum) ? [1, 3] : [1, 6].includes(lastNum) ? [0, 2] : [2, 7].includes(lastNum) ? [1, 4] : [3, 8].includes(lastNum) ? [0, 3] : [1, 2]);
        let numbersStr = matchedNumbers.join(", ");
        let colorStr = (matchedNumbers.includes(0) ? "🔴 RED / 🟣 VIOLET" : matchedNumbers.includes(5) ? "🟢 GREEN / 🟣 VIOLET" : predResult === "BIG" ? "🟢 GREEN" : "🔴 RED");
        return { predResult, targetNumbers: matchedNumbers, numbersStr, colorStr };
    } catch (e) { return { predResult: "BIG", targetNumbers: [6, 8], numbersStr: "6, 8", colorStr: "🟢 GREEN" }; }
}

async function fetchWinGoData() {
    try {
        const response = await axios.get(SCRAPINGANT_URL, { timeout: 30000 });
        let list = response.data?.data?.list || response.data?.list;
        if (!list || !Array.isArray(list)) return;

        let lastItem = list[0];
        let actualNum = parseInt(lastItem.number ?? lastItem.result);
        let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
        let actualPeriod = String(lastItem.issueName ?? lastItem.issue);
        let nextPeriod = String(BigInt(actualPeriod) + 1n);
        let dynamicStatusMsg = "";

        if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
            let isResultHit = (lastPredictedResult === actualResult);
            let currentBetVal = getBetVal(maintenanceLevel);
            predictionCount++;
            
            if (isResultHit) {
                totalWins++;
                let winAmount = (currentBetVal * 0.98).toFixed(2);
                totalProfitLoss += parseFloat(winAmount);
                dynamicStatusMsg = `🎉 **CONGRATULATIONS (LEVEL ${maintenanceLevel} (₹${winAmount} WIN))** 🎉\n🏆 **${actualResult} (${actualNum}) WIN**`;
                maintenanceLevel = 1;
            } else {
                totalLosses++;
                totalProfitLoss -= currentBetVal;
                dynamicStatusMsg = `💔 **LOSS: ${actualResult} (${actualNum})**\n➡️ **NEXT LEVEL PARTHU KIRAM (LEVEL ${maintenanceLevel + 1})**`;
                maintenanceLevel++;
            }

            if (predictionCount >= 60) {
                let summaryMsg = "📊 **60 PREDICTIONS BATCH SUMMARY REPORT** 📊\n" +
                                 "🎯 **TOTAL WINS:** " + totalWins + " | 💔 **LOSSES:** " + totalLosses + "\n" +
                                 "💰 **TOTAL PROFIT:** ₹" + totalProfitLoss.toFixed(2) + "\n━━━━━━━━━━━━━━━━━━━━━";
                await bot.sendMessage(MAIN_CHANNEL, summaryMsg, { parse_mode: 'Markdown' });
                await bot.sendMessage(REPORT_CHANNEL, summaryMsg, { parse_mode: 'Markdown' });
                predictionCount = 0; totalWins = 0; totalLosses = 0; totalProfitLoss = 0; maintenanceLevel = 1;
            }
        }

        if (nextPeriod !== lastSentPeriod) {
            let pred = deepHistoryPatternEngine(list);
            let msg = `🔥 **WINGO 30S PREDICTION** 🔥\n📌 **PERIOD:** \`${nextPeriod}\`\n🎲 **BET:** **${pred.predResult}**\n🎨 **COLOUR:** ${pred.colorStr}\n💰 **LEVEL:** ${maintenanceLevel} (${levelData[maintenanceLevel].name})\n━━━━━━━━━━━━━━━━━━━━━\n${dynamicStatusMsg}\n🔗 **Link:** ${REGISTER_LINK}`;
            
            await bot.sendMessage(MAIN_CHANNEL, msg, { parse_mode: 'Markdown' });
            lastSentPeriod = nextPeriod;
            lastPredictedPeriod = nextPeriod;
            lastPredictedResult = pred.predResult;
            lastPredictedNumbers = pred.targetNumbers;
        }
    } catch (e) { console.error(e.message); }
}

async function startContinuousLoop() { while (true) { await fetchWinGoData(); await new Promise(r => setTimeout(r, 6000)); } }
app.listen(PORT, '0.0.0.0', () => { console.log("Bot Active"); startContinuousLoop(); });
