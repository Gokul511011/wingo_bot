const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render Deployment
const app = express();
const PORT = process process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 30S High Precision Engine Active!'));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';

// Your ScrapingAnt API Key
const SCRAPINGANT_API_KEY = '2a3f73c602be4a9c8abd9ae09cb196a9'; 

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
    1: { name: "₹1", val: 1 },
    2: { name: "₹3", val: 3 },
    3: { name: "₹9", val: 9 },
    4: { name: "₹27", val: 27 },
    5: { name: "₹81", val: 81 },
    6: { name: "₹243", val: 243 },
    7: { name: "₹729", val: 729 },
    8: { name: "₹2187", val: 2187 }
};

function invertPattern(str) {
    return str.split('').map(char => char === 'B' ? 'S' : (char === 'S' ? 'B' : char)).join('');
}

function deepHistoryPatternEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let seq5 = allResults.slice(0, 5).join(""); 
        let predResult = "";

        // Pattern Matching Logic
        if (seq5 === "BSBBS") {
            predResult = "BIG";
        } else if (seq5 === "SBSSB") {
            predResult = "SMALL";
        } 
        else if (allResults[0] === allResults[1] && allResults[1] === allResults[2]) {
            predResult = allResults[0] === "B" ? "BIG" : "SMALL";
        } 
        else if (allResults[0] !== allResults[1] && allResults[1] !== allResults[2] && allResults[2] !== allResults[3]) {
            predResult = allResults[0] === "B" ? "SMALL" : "BIG";
        }
        else {
            let scoreB = 0;
            let scoreS = 0;
            let mirrorSeq5 = invertPattern(seq5);

            for (let i = 1; i < allResults.length - 6; i++) {
                let histSeq5 = allResults.slice(i, i + 5).join("");
                let nextItem = allResults[i - 1];
                let weight = i < 30 ? 3 : 1;

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

        // HIGH ACCURACY NUMBER PREDICTION
        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let numberFrequency = {};
        candidateNums.forEach(n => numberFrequency[n] = 0);

        for (let i = 0; i < Math.min(50, allNumbers.length); i++) {
            let num = allNumbers[i];
            if (candidateNums.includes(num)) {
                let recencyWeight = (50 - i);
                numberFrequency[num] = (numberFrequency[num] || 0) + recencyWeight;
            }
        }

        let sortedNumbers = candidateNums.sort((a, b) => numberFrequency[b] - numberFrequency[a]);
        let matchedNumbers = sortedNumbers.slice(0, 2);

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
        // ScrapingAnt Endpoint with browser=false (Consume 1 Credit per Request)
        const scraperUrl = `https://api.scrapingant.com/v1/general?url=${encodeURIComponent(TARGET_URL)}&x-api-key=${SCRAPINGANT_API_KEY}&browser=false`;
        const response = await axios.get(scraperUrl, { timeout: 8000 });
        
        let data = response.data;
        if (data && data.content) {
            try { data = JSON.parse(data.content); } catch (e) {}
        }

        let list = data?.data?.list || data?.list || data;

        if (Array.isArray(list) && list.length > 0) {
            let lastItem = list[0];
            let actualNum = parseInt(lastItem.number !== undefined ? lastItem.number : lastItem.result);
            let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
            let actualColor = (actualNum === 0 || actualNum === 5) ? "VIOLET" : (actualNum >= 5 ? "GREEN" : "RED");
            let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue);
            
            let nextPeriod = String(BigInt(actualPeriod) + 1n);
            let dynamicStatusMsg = "";

            if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
                let isResultHit = (lastPredictedResult === actualResult);
                let isNumberHit = lastPredictedNumbers.includes(actualNum);
                let isColorHit = (lastPredictedColor === actualColor) || (actualColor === "VIOLET");

                let currentLevelExecuted = maintenanceLevel;

                if (isResultHit) {
                    totalWins++;
                    consecLosses = 0;

                    if (isResultHit && isNumberHit && isColorHit) {
                        dynamicStatusMsg = "🏆 **" + actualResult + " " + actualNum + " " + actualColor + " JACKPOT WINNERS** 🏆";
                    } 
                    else if (isResultHit && isNumberHit) {
                        dynamicStatusMsg = "🏆 **" + actualResult + " " + actualNum + " JACKPOT WINNER** 🏆";
                    } 
                    else if (isResultHit && isColorHit) {
                        dynamicStatusMsg = "🏆 **" + actualResult + " " + actualColor + " WINNER CONGRATULATIONS** 🏆";
                    } 
                    else {
                        dynamicStatusMsg = "🏆 **" + actualResult + " WIN** 🏆";
                    }

                    prediction60History.unshift({ period: actualPeriod, status: "WIN", level: currentLevelExecuted });
                    maintenanceLevel = 1;

                } else {
                    totalLosses++;
                    consecLosses++;

                    dynamicStatusMsg = "🎲 **RESULT: " + actualResult + " (" + actualNum + ")**";

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
                
                let activeLevel = maintenanceLevel;
                let nextLevel = (activeLevel >= 8) ? 1 : activeLevel + 1;
                
                let currentLevelInfo = levelData[activeLevel] || levelData[1];
                let nextLevelInfo = levelData[nextLevel] || levelData[1];

                let msg = "👑 **KING PREDICTION**\n" +
                          "⚡ **WinGo 30S** ⚡\n" +
                          "━━━━━━━━━━━━━━━━━━━━━\n" +
                          "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                          "🎯 **TARGET:** **" + pred.predResult + "**\n" +
                          "🔢 **NUMBERS:** `" + pred.numbersStr + "`\n" +
                          "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                          "💰 **LEVEL AMOUNT:** **Level " + activeLevel + " (" + currentLevelInfo.name + ")**\n" +
                          "👉 **NEXT BET:** **Level " + nextLevel + " (" + nextLevelInfo.name + ")** *(If Level " + activeLevel + " Losses)*\n" +
                          "━━━━━━━━━━━━━━━━━━━━━\n";

                if (dynamicStatusMsg !== "") {
                    msg += dynamicStatusMsg + "\n━━━━━━━━━━━━━━━━━━━━━\n";
                }

                msg += "🏆 **WINS:** " + totalWins + "\n" +
                       "💔 **LOSSES:** " + totalLosses + "\n" +
                       "━━━━━━━━━━━━━━━━━━━━━\n\n" +
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
