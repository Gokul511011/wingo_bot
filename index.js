const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render Deployment
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 30S Advanced Profit & Pattern Engine Active!'));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
const SCRAPER_API_KEY = 'c725f6d2ecb43122c28b14448f9c0c61'; 

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=1000&pageNo=1';
const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedNumbers = [];
let lastPredictedColor = "";
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let consecLosses = 0;
let maintenanceLevel = 1;
let cooldownCounter = 0;

let prediction60History = [];

// 8 Level Bet Plan starting from ₹1 (3x Multiplier)
const levelData = {
    1: { name: "₹1", val: 1, winPayout: 1.96 },
    2: { name: "₹3", val: 3, winPayout: 5.88 },
    3: { name: "₹9", val: 9, winPayout: 17.64 },
    4: { name: "₹27", val: 27, winPayout: 52.92 },
    5: { name: "₹81", val: 81, winPayout: 158.76 },
    6: { name: "₹243", val: 243, winPayout: 476.28 },
    7: { name: "₹729", val: 729, winPayout: 1428.84 },
    8: { name: "₹2187", val: 2187, winPayout: 4286.52 }
};

function deepHistoryPatternEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let recentPattern = allResults.slice(0, 4).join(""); 
        let predResult = "BIG";

        if (allResults[0] === allResults[1] && allResults[1] === allResults[2]) {
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

            for (let i = 1; i < allResults.length - 5; i++) {
                let historicalSeq = allResults.slice(i, i + 4).join("");
                if (recentPattern === historicalSeq) {
                    let nextItem = allResults[i - 1];
                    if (nextItem === "B") scoreB++;
                    if (nextItem === "S") scoreS++;
                }
            }

            if (scoreB > scoreS) predResult = "BIG";
            else if (scoreS > scoreB) predResult = "SMALL";
            else predResult = allResults[0] === "B" ? "BIG" : "SMALL"; 
        }

        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let recent3Nums = allNumbers.slice(0, 3);
        let matchedNumbers = [];

        for (let i = 1; i < allNumbers.length - 4; i++) {
            let matches = 0;
            if (allNumbers[i] === recent3Nums[0]) matches++;
            if (allNumbers[i + 1] === recent3Nums[1]) matches++;
            if (allNumbers[i + 2] === recent3Nums[2]) matches++;

            if (matches >= 2) { 
                let historicalNextNum = allNumbers[i - 1];
                if (candidateNums.includes(historicalNextNum) && !matchedNumbers.includes(historicalNextNum)) {
                    matchedNumbers.push(historicalNextNum);
                }
            }
            if (matchedNumbers.length >= 2) break;
        }

        if (matchedNumbers.length < 2) {
            let defaultPicks = candidateNums.filter(n => !matchedNumbers.includes(n));
            matchedNumbers.push(...defaultPicks.slice(0, 2 - matchedNumbers.length));
        }

        let numbersStr = matchedNumbers.join(", ");
        let mainColor = predResult === "BIG" ? "GREEN" : "RED";
        let colorStr = mainColor === "GREEN" ? "🟢 GREEN" : "🔴 RED";
        if (matchedNumbers.includes(0) || matchedNumbers.includes(5)) {
            colorStr += " / 🟣 VIOLET";
        }

        return { predResult, targetNumbers: matchedNumbers, numbersStr, colorStr, mainColor };

    } catch (e) {
        console.error("Pattern Engine Error:", e.message);
        return { predResult: "BIG", targetNumbers: [7, 8], numbersStr: "7, 8", colorStr: "🟢 GREEN", mainColor: "GREEN" };
    }
}

async function fetchWinGoData() {
    try {
        const scraperUrl = "http://api.scraperapi.com?api_key=" + SCRAPER_API_KEY + "&url=" + encodeURIComponent(TARGET_URL) + "&render=false&premium=false";
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
            let actualColor = (actualNum === 0 || actualNum === 5) ? "VIOLET" : (actualNum >= 5 ? "GREEN" : "RED");
            let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue);
            
            let nextPeriod = String(BigInt(actualPeriod) + 1n);
            let dynamicWinMsg = "";

            if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
                let isResultHit = (lastPredictedResult === actualResult);
                let isNumberHit = lastPredictedNumbers.includes(actualNum);
                let isColorHit = (lastPredictedColor === actualColor) || (actualColor === "VIOLET");

                let currentLevelExecuted = maintenanceLevel;

                if (isResultHit) {
                    totalWins++;
                    consecLosses = 0;

                    let winParts = [];
                    if (isResultHit) winParts.push(actualResult + " WIN");
                    if (isNumberHit) winParts.push(actualNum + " WIN");
                    if (isColorHit) winParts.push(actualColor + " WIN");
                    if (isNumberHit) winParts.push("JACKPOT NUMBERS");

                    dynamicWinMsg = "🏆 **" + winParts.join(" ") + "** 🏆";

                    prediction60History.unshift({ period: actualPeriod, status: "WIN", level: currentLevelExecuted });
                    maintenanceLevel = 1;

                } else {
                    totalLosses++;
                    consecLosses++;
                    
                    prediction60History.unshift({ period: actualPeriod, status: "LOSS", level: currentLevelExecuted });
                    maintenanceLevel++;

                    if (consecLosses >= 6) {
                        cooldownCounter = 5;
                        consecLosses = 0;
                        maintenanceLevel = 1;
                        await bot.sendMessage(CHANNEL_ID, "⚠️ **6 CONTINUOUS LOSSES DETECTED!**\n🛑 Bot is taking a break for 5 predictions to prevent loss during bad pattern trend.", { parse_mode: 'Markdown' });
                    }

                    if (maintenanceLevel > 8) maintenanceLevel = 1;
                }

                if (prediction60History.length > 60) {
                    prediction60History.pop();
                }
            }

            if (nextPeriod !== lastSentPeriod) {
                if (cooldownCounter > 0) {
                    cooldownCounter--;
                    console.log(`[STOP SYSTEM] Cooldown active. Remaining predictions to skip: ${cooldownCounter}`);
                    lastSentPeriod = nextPeriod;
                    return;
                }

                let pred = deepHistoryPatternEngine(list);
                let currentLevelInfo = levelData[maintenanceLevel] || levelData[1];
                let nextLevelInfo = levelData[maintenanceLevel + 1] || levelData[1];

                let msg = "👑 **KING PREDICTION**\n" +
                          "⚡ **WinGo 30S** ⚡\n" +
                          "━━━━━━━━━━━━━━━━━━━━━\n" +
                          "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                          "🎯 **TARGET:** **" + pred.predResult + "**\n" +
                          "🔢 **NUMBERS:** `" + pred.numbersStr + "`\n" +
                          "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                          "💰 **LEVEL AMOUNT:** **Level " + maintenanceLevel + " (" + currentLevelInfo.name + ")**\n" +
                          "👉 **NEXT BET:** **Level " + (maintenanceLevel + 1) + " (" + nextLevelInfo.name + ")** *(If Level " + maintenanceLevel + " Losses)*\n" +
                          "━━━━━━━━━━━━━━━━━━━━━\n";

                if (dynamicWinMsg !== "") {
                    msg += dynamicWinMsg + "\n━━━━━━━━━━━━━━━━━━━━━\n";
                }

                let historyLen = prediction60History.length;
                let wins60 = prediction60History.filter(x => x.status === "WIN").length;
                let losses60 = prediction60History.filter(x => x.status === "LOSS").length;

                let levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
                let netProfit = 0;

                prediction60History.forEach(item => {
                    let lvl = item.level;
                    let info = levelData[lvl] || levelData[1];

                    if (item.status === "WIN") {
                        if (levelCounts[lvl] !== undefined) levelCounts[lvl]++;
                        netProfit += (info.winPayout - info.val);
                    } else if (item.status === "LOSS") {
                        netProfit -= info.val;
                    }
                });

                // லாபம் அல்லது நஷ்டம் குறிக்கும் குறி (+ அல்லது -)
                let profitSign = netProfit >= 0 ? "+₹" : "-₹";

                // எப்போதுமே Wins, Losses மற்றும் Net Profit காட்டப்படும்
                msg += "\n📊 **LAST " + historyLen + " PREDICTIONS REPORT:**\n" +
                       "━━━━━━━━━━━━━━━━━━━━━\n" +
                       "🏆 **TOTAL WINS:** " + wins60 + " / " + historyLen + "\n" +
                       "💔 **TOTAL LOSSES:** " + losses60 + " / " + historyLen + "\n" +
                       "💵 **OVERALL NET PROFIT:** **" + profitSign + Math.abs(netProfit).toFixed(2) + "**\n";

                // 60 Predictions சேகரிக்கப்பட்ட பிறகு மட்டுமே Level Wins Breakdown காட்டப்படும்
                if (historyLen >= 60) {
                    msg += "━━━━━━━━━━━━━━━━━━━━━\n" +
                           "🎯 **LEVEL WINS BREAKDOWN:**\n" +
                           "• **Level 1 Wins:** " + levelCounts[1] + "\n" +
                           "• **Level 2 Wins:** " + levelCounts[2] + "\n" +
                           "• **Level 3 Wins:** " + levelCounts[3] + "\n" +
                           "• **Level 4 Wins:** " + levelCounts[4] + "\n" +
                           "• **Level 5 Wins:** " + levelCounts[5] + "\n" +
                           "• **Level 6 Wins:** " + levelCounts[6] + "\n" +
                           "• **Level 7 Wins:** " + levelCounts[7] + "\n" +
                           "• **Level 8 Wins:** " + levelCounts[8] + "\n";
                }

                msg += "━━━━━━━━━━━━━━━━━━━━━\n\n" +
                       "🔗 **Register Link:**\n" + REGISTER_LINK;

                await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });

                lastSentPeriod = nextPeriod;
                lastPredictedPeriod = nextPeriod;
                lastPredictedResult = pred.predResult;
                lastPredictedNumbers = pred.targetNumbers;
                lastPredictedColor = pred.mainColor;
                console.log("[SUCCESS] Prediction Sent: " + nextPeriod);
            }
        }
    } catch (error) {
        console.error('[FETCH ERROR]:', error.message);
    }
}

setInterval(fetchWinGoData, 8000);
