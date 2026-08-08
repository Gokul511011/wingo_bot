const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;

const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';

// பல சேனல்களின் ஐடிகள் (Channel 1, Channel 2 மற்றும் உங்கள் பழைய சேனல்)
const CHANNEL_IDS = ['1003293600118', '-1003310985903', '-1002486828817'];

const RAW_TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=1000&pageNo=1';
const SCRAPINGANT_API_KEY = 'd717a6d4020b465aac8d0eed35459624'; 

const SCRAPINGANT_URL = `https://api.scrapingant.com/v2/general?x-api-key=${SCRAPINGANT_API_KEY}&url=${encodeURIComponent(RAW_TARGET_URL)}&proxy_country=in&browser=false`;

const REGISTER_LINK = 'https://www.rajastake7.com/#/register?invitationCode=172723872480';

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// அனைத்து சேனல்களுக்கும் ஒரே நேரத்தில் மெசேஜ் அனுப்பும் வசதி
async function sendToAllChannels(message, options = {}) {
    for (const channelId of CHANNEL_IDS) {
        try {
            await bot.sendMessage(channelId, message, options);
        } catch (e) {
            console.error(`Error sending to channel ${channelId}:`, e.message);
        }
    }
}

app.get('/', (req, res) => res.send('WinGo 30S Multi-Channel Bot Active!'));

app.listen(PORT, '0.0.0.0', async () => {
    console.log("Server running on port " + PORT);
    try {
        await sendToAllChannels("🚀 **WinGo Bot Live & Running Non-Stop...**", { parse_mode: 'Markdown' });
    } catch (e) {
        console.error("Startup Error:", e.message);
    }
    startContinuousLoop();
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

function deepHistoryPatternEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "BIG" : "SMALL");

        let r1 = allResults[0];
        let r2 = allResults[1];
        let r3 = allResults[2];
        let r4 = allResults[3];

        let predResult = "";

        if (r1 !== r2 && r2 !== r3 && r3 !== r4) {
            predResult = r1 === "BIG" ? "SMALL" : "BIG"; 
        } else if (r1 === r2) {
            predResult = r1; 
        } else {
            predResult = r1;
        }

        const lastNum = allNumbers[0] !== undefined ? allNumbers[0] : 5;
        let matchedNumbers = [];

        if (predResult === "BIG") {
            if ([5, 0].includes(lastNum)) matchedNumbers = [6, 8];
            else if ([6, 1].includes(lastNum)) matchedNumbers = [7, 9];
            else if ([7, 2].includes(lastNum)) matchedNumbers = [5, 8];
            else if ([8, 3].includes(lastNum)) matchedNumbers = [6, 9];
            else matchedNumbers = [7, 8];
        } else {
            if ([0, 5].includes(lastNum)) matchedNumbers = [1, 3];
            else if ([1, 6].includes(lastNum)) matchedNumbers = [0, 2];
            else if ([2, 7].includes(lastNum)) matchedNumbers = [1, 4];
            else if ([3, 8].includes(lastNum)) matchedNumbers = [0, 3];
            else matchedNumbers = [1, 2];
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
        return { predResult: "BIG", targetNumbers: [6, 8], numbersStr: "6, 8", colorStr: "🟢 GREEN", mainColor: "GREEN" };
    }
}

async function fetchWinGoData() {
    try {
        const response = await axios.get(SCRAPINGANT_URL, { 
            headers: { 'Accept': 'application/json' },
            timeout: 30000 
        });
        
        let rawContent = response.data.content || response.data;
        let parsedData = null;

        if (typeof rawContent === 'object') {
            parsedData = rawContent;
        } else if (typeof rawContent === 'string') {
            const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsedData = JSON.parse(jsonMatch[0]);
            }
        }

        if (!parsedData) {
            console.log("Empty or Invalid Response from ScrapingAnt, retrying...");
            return;
        }

        let list = parsedData?.data?.list || parsedData?.list || (Array.isArray(parsedData) ? parsedData : null);

        if (!list || !Array.isArray(list) || list.length === 0) {
            console.log("Data list is empty, retrying...");
            return;
        }

        let lastItem = list[0];
        let actualNum = parseInt(lastItem.number !== undefined ? lastItem.number : (lastItem.result !== undefined ? lastItem.result : lastItem.numberValue));
        let actualResult = actualNum >= 5 ? "BIG" : "SMALL";
        let actualColor = getNumberColor(actualNum);
        let actualPeriod = String(lastItem.issueName || lastItem.issueNumber || lastItem.period || lastItem.issue || lastItem.issueCode);
        
        let nextPeriod = String(BigInt(actualPeriod) + 1n);
        let dynamicStatusMsg = "";

        if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
            let isResultHit = (lastPredictedResult === actualResult);
            let isNumberHit = lastPredictedNumbers.includes(actualNum);

            let currentLevelExecuted = maintenanceLevel;
            let currentBetVal = getBetVal(currentLevelExecuted);

            if (currentLevelExecuted > maxLevelReached) {
                maxLevelReached = currentLevelExecuted;
            }

            predictionCount++;

            if (isResultHit) {
                totalWins++;

                if (levelWins[currentLevelExecuted] !== undefined) {
                    levelWins[currentLevelExecuted]++;
                } else {
                    levelWins[currentLevelExecuted] = 1;
                }

                let winAmount = currentBetVal * 0.98;
                totalProfitLoss += winAmount;

                if (isNumberHit) {
                    totalJackpots++;
                    dynamicStatusMsg = "🏆 **" + actualResult + " (" + actualNum + ") JACKPOT WINNER** 🏆";
                } else {
                    dynamicStatusMsg = "🏆 **" + actualResult + " (" + actualNum + ") WIN** 🏆";
                }

                maintenanceLevel = 1; 

            } else {
                totalLosses++;
                totalProfitLoss -= currentBetVal;

                dynamicStatusMsg = "💔 **LOSS: " + actualResult + " (" + actualNum + " - " + actualColor + ")**";

                maintenanceLevel++; 
            }

            if (predictionCount >= 60) {
                let profitSign = totalProfitLoss >= 0 ? "₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);
                
                let summaryMsg = "📊 **60 PREDICTIONS BATCH SUMMARY REPORT** 📊\n" +
                                 "━━━━━━━━━━━━━━━━━━━━━\n" +
                                 "🎯 **TOTAL PREDICTIONS:** 60\n" +
                                 "🏆 **BIG / SMALL WINS:** " + totalWins + "\n" +
                                 "💥 **JACKPOT WINS:** " + totalJackpots + "\n" +
                                 "💔 **LOSSES:** " + totalLosses + "\n" +
                                 "📈 **MAX LEVEL REACHED:** Level " + maxLevelReached + "\n" +
                                 "💰 **TOTAL PROFIT:** **" + profitSign + "**\n" +
                                 "━━━━━━━━━━━━━━━━━━━━━\n" +
                                 "🎯 **LEVEL-WISE WINS BREAKDOWN:**\n" +
                                 "🔹 LEVEL 1: " + levelWins[1] + " WINS\n" +
                                 "🔹 LEVEL 2: " + levelWins[2] + " WINS\n" +
                                 "🔹 LEVEL 3: " + levelWins[3] + " WINS\n" +
                                 "🔹 LEVEL 4: " + levelWins[4] + " WINS\n" +
                                 "🔹 LEVEL 5: " + levelWins[5] + " WINS\n" +
                                 "🔹 LEVEL 6: " + levelWins[6] + " WINS\n" +
                                 "🔹 LEVEL 7: " + levelWins[7] + " WINS\n" +
                                 "🔹 LEVEL 8: " + levelWins[8] + " WINS\n" +
                                 "━━━━━━━━━━━━━━━━━━━━━\n" +
                                 "🔄 **Batch completed! Resetting stats for the next 60 rounds non-stop!**";

                await sendToAllChannels(summaryMsg, { parse_mode: 'Markdown' });

                predictionCount = 0;
                totalWins = 0;
                totalLosses = 0;
                totalJackpots = 0;
                totalProfitLoss = 0;
                maxLevelReached = 1;
                levelWins = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
            }
        }

        if (nextPeriod !== lastSentPeriod) {
            let pred = deepHistoryPatternEngine(list);
            
            let activeLevel = maintenanceLevel;
            let currentBetName = levelData[activeLevel]?.name || ("₹" + getBetVal(activeLevel));

            let profitSign = totalProfitLoss >= 0 ? "₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);

            let msg = "🔥 **WINGO 30S PREDICTION** 🔥\n" +
                      "━━━━━━━━━━━━━━━━━━━━━\n" +
                      "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                      "🎲 **BET:** **" + pred.predResult + "**\n" +
                      "🔢 **PRED NO:** `" + pred.numbersStr + "`\n" +
                      "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                      "💰 **BET LEVEL AMT:** **LEVEL " + activeLevel + " (" + currentBetName + ")**\n" +
                      "━━━━━━━━━━━━━━━━━━━━━\n";

            if (dynamicStatusMsg !== "") {
                msg += dynamicStatusMsg + "\n━━━━━━━━━━━━━━━━━━━━━\n";
            }

            msg += "🔢 **PROGRESS:** " + predictionCount + " / 60\n" +
                   "🏆 **B/S WINS:** " + totalWins + " | 💥 **JK:** " + totalJackpots + " | 💔 **LOSS:** " + totalLosses + "\n" +
                   "📊 **TOTAL PROFIT:** **" + profitSign + "**\n" +
                   "━━━━━━━━━━━━━━━━━━━━━\n" +
                   "🎯 **LIVE LEVEL WINS:**\n" +
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

            await sendToAllChannels(msg, { parse_mode: 'Markdown' });

            lastSentPeriod = nextPeriod;
            lastPredictedPeriod = nextPeriod;
            lastPredictedResult = pred.predResult;
            lastPredictedNumbers = pred.targetNumbers;
            lastPredictedColor = pred.mainColor;
            console.log("[CONTINUOUS] Sent Period: " + nextPeriod + " to all channels (" + predictionCount + "/60)");
        }
    } catch (error) {
        console.error('[API FETCH ERROR]:', error.message);
    }
}

async function startContinuousLoop() {
    while (true) {
        await fetchWinGoData();
        await new Promise(resolve => setTimeout(resolve, 6000));
    }
}

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));
