
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Express Server for Render
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('WinGo 30S Optimized Engine Active!'));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port " + PORT));

// Configuration
const BOT_TOKEN = '8950819463:AAGrZXE-tL39JbvBP9wkc9fDzRFsTxxWYUU';
const CHANNEL_ID = '-1002486828817';
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

// Optimized Pattern Analysis Engine (Level Skip Protection)
function deepHistoryPatternEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "B" : "S");

        let predResult = "";

        // 1. Long Streak Protection (B-B-B-B or S-S-S-S)
        if (allResults[0] === allResults[1] && allResults[1] === allResults[2] && allResults[2] === allResults[3]) {
            predResult = allResults[0] === "B" ? "BIG" : "SMALL"; // Follow the streak trend
        }
        // 2. Strict 3-Consecutive Rule
        else if (allResults[0] === allResults[1] && allResults[1] === allResults[2]) {
            predResult = allResults[0] === "B" ? "BIG" : "SMALL";
        }
        // 3. Strict Alternate / Zig-Zag Rule (B-S-B-S)
        else if (allResults[0] !== allResults[1] && allResults[1] !== allResults[2] && allResults[2] !== allResults[3]) {
            predResult = allResults[0] === "B" ? "SMALL" : "BIG";
        }
        // 4. Double-Double Pattern (B-B-S-S)
        else if (allResults[0] === allResults[1] && allResults[2] === allResults[3] && allResults[0] !== allResults[2]) {
            predResult = allResults[0] === "B" ? "SMALL" : "BIG";
        }
        // 5. Deep Pattern Matching with High Recency Weight
        else {
            let scoreB = 0;
            let scoreS = 0;
            let seq5 = allResults.slice(0, 5).join("");
            let mirrorSeq5 = invertPattern(seq5);

            for (let i = 1; i < Math.min(80, allResults.length - 6); i++) {
                let histSeq5 = allResults.slice(i, i + 5).join("");
                let nextItem = allResults[i - 1];
                
                // Recent history gets significantly higher weight to stop high-level loss
                let weight = i < 10 ? 6 : (i < 25 ? 3 : 1);

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

        // Number Selection Optimization based on recent hits
        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let numberFrequency = {};
        candidateNums.forEach(n => numberFrequency[n] = 0);

        for (let i = 0; i < Math.min(25, allNumbers.length); i++) {
            let num = allNumbers[i];
            if (candidateNums.includes(num)) {
                let recencyWeight = (25 - i);
                numberFrequency[num] = (numberFrequency[num] || 0) + recencyWeight;
            }
        }

        let sortedNumbers = candidateNums.sort((a, b) => numberFrequency[b] - numberFrequency[a]);
        let matchedNumbers = sortedNumbers.slice(0, 2);

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
        return { predResult: "BIG", targetNumbers: [7, 8], numbersStr: "7, 8", colorStr: "🟢 GREEN", mainColor: "GREEN" };
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
            const scraperUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(TARGET_URL)}&x-api-key=${SCRAPINGANT_API_KEY}&browser=false&return_page_source=false`;
            const response = await axios.get(scraperUrl, { timeout: 12000 });
            rawContent = response.data;
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
                    dynamicStatusMsg = "🏆 **" + actualResult + " (" + actualNum + ") " + actualColor + " JACKPOT WINNERS** 🏆";
                } 
                else if (isNumberHit) {
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

            if (predictionCount >= 60) {
                let profitSign = totalProfitLoss >= 0 ? "+₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);
                
                let summaryMsg = "📊 **60 PREDICTIONS TEST SUMMARY REPORT** 📊\n" +
                                 "━━━━━━━━━━━━━━━━━━━━━\n" +
                                 "🎯 **TOTAL PREDICTIONS:** 60\n" +
                                 "🏆 **TOTAL WINS:** " + totalWins + "\n" +
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

                summaryMsg += "━━━━━━━━━━━━━━━━━━━━━\n🔄 **Resetting stats for the next 60 rounds!**";

                await bot.sendMessage(CHANNEL_ID, summaryMsg, { parse_mode: 'Markdown' });

                predictionCount = 0;
                totalWins = 0;
                totalLosses = 0;
                totalProfitLoss = 0;
                maxLevelReached = 1;
                prediction60History = [];
            }
        }

        if (nextPeriod !== lastSentPeriod) {
            let pred = deepHistoryPatternEngine(list);
            
            let activeLevel = maintenanceLevel;
            let nextLevel = activeLevel + 1;
            
            let currentBetName = levelData[activeLevel]?.name || ("₹" + getBetVal(activeLevel));
            let nextBetName = levelData[nextLevel]?.name || ("₹" + getBetVal(nextLevel));

            let profitSign = totalProfitLoss >= 0 ? "+₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);

            let msg = "👑 **KING PREDICTION**\n" +
                      "⚡ **WinGo 30S (60-Run Test)** ⚡\n" +
                      "━━━━━━━━━━━━━━━━━━━━━\n" +
                      "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                      "🎯 **TARGET:** **" + pred.predResult + "**\n" +
                      "🔢 **NUMBERS:** `" + pred.numbersStr + "`\n" +
                      "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                      "💰 **BET AMOUNT:** **" + currentBetName + " (Level " + activeLevel + ")**\n" +
                      "👉 **IF LOSS NEXT BET:** **" + nextBetName + " (Level " + nextLevel + ")**\n" +
                      "━━━━━━━━━━━━━━━━━━━━━\n";

            if (dynamicStatusMsg !== "") {
                msg += dynamicStatusMsg + "\n━━━━━━━━━━━━━━━━━━━━━\n";
            }

            msg += "🔢 **PROGRESS:** " + predictionCount + " / 60\n" +
                   "🏆 **WINS:** " + totalWins + " | 💔 **LOSSES:** " + totalLosses + "\n" +
                   "📊 **TOTAL PROFIT / LOSS:** **" + profitSign + "**\n" +
                   "━━━━━━━━━━━━━━━━━━━━━\n\n" +
                   "🔗 **Register Link:**\n" + REGISTER_LINK;

            await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });

            lastSentPeriod = nextPeriod;
            lastPredictedPeriod = nextPeriod;
            lastPredictedResult = pred.predResult;
            lastPredictedNumbers = pred.targetNumbers;
            lastPredictedColor = pred.mainColor;
            console.log("[RUNNING] Sent Period: " + nextPeriod + " (" + predictionCount + "/60)");
        }
    } catch (error) {
        console.error('[FETCH ERROR]:', error.message);
    } finally {
        isFetching = false;
    }
}

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));

setInterval(fetchWinGoData, 10000);
