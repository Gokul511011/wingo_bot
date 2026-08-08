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

let lastSentPeriod = "";
let lastPredictedResult = null;
let lastPredictedNumbers = [];
let lastPredictedPeriod = null;

let totalWins = 0;
let totalLosses = 0;
let totalJackpots = 0;
let maintenanceLevel = 1; // Strict capping up to level 4 max
let totalProfitLoss = 0;
let predictionCount = 0;
let maxLevelReached = 1;

let levelWins = { 1: 0, 2: 0, 3: 0, 4: 0 };

const levelData = {
    1: { name: "₹1", val: 1 },
    2: { name: "₹3", val: 3 },
    3: { name: "₹9", val: 9 },
    4: { name: "₹27", val: 27 }
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

// Advanced Dragon & Block Pattern Engine (3-1-3, 2-1-2-1, 4-4-2-2, 5-1-4 etc.) with Break Detection
function dragonBlockPatternEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "BIG" : "SMALL");

        if (allResults.length < 20) {
            return { predResult: "BIG", targetNumbers: [6, 8], numbersStr: "6, 8", colorStr: "🟢 GREEN" };
        }

        // Convert sequence into consecutive block counts (e.g., [3, 1, 3] means 3 Bigs, 1 Small, 3 Bigs)
        let blocks = [];
        let currentType = allResults[0];
        let currentCount = 0;

        for (let r of allResults) {
            if (r === currentType) {
                currentCount++;
            } else {
                blocks.push({ type: currentType, count: currentCount });
                currentType = r;
                currentCount = 1;
            }
        }
        blocks.push({ type: currentType, count: currentCount });

        // Analyze recent block structure to detect breaking patterns or continuing dragon blocks
        let recentCounts = blocks.slice(0, 5).map(b => b.count);
        let latestBlockType = blocks[0].type;
        let latestBlockCount = blocks[0].count;

        let predResult = "BIG";

        // Dragon / Block Break Detection Logic
        if (latestBlockCount >= 4) {
            // If a single block has grown too large (e.g., 4 or more continuous Big/Small), pattern is about to break!
            predResult = latestBlockType === "BIG" ? "SMALL" : "BIG";
        } else if (recentCounts.length >= 3) {
            // Check matching block sequences in history for high accuracy
            let b1 = recentCounts[0];
            let b2 = recentCounts[1];
            let b3 = recentCounts[2];

            let matchBigNext = 0;
            let matchSmallNext = 0;

            for (let i = 2; i < blocks.length - 1; i++) {
                if (blocks[i].count === b3 && blocks[i-1].count === b2 && blocks[i]?.count === b1) {
                    let nextBlockType = blocks[i-2]?.type;
                    if (nextBlockType === "BIG") matchBigNext++;
                    else if (nextBlockType === "SMALL") matchSmallNext++;
                }
            }

            if (matchBigNext + matchSmallNext >= 2) {
                predResult = matchBigNext >= matchSmallNext ? "BIG" : "SMALL";
            } else {
                // Default anti-trend switch based on recent alternation
                predResult = latestBlockType === "BIG" ? "SMALL" : "BIG";
            }
        } else {
            predResult = latestBlockType === "BIG" ? "SMALL" : "BIG";
        }

        const lastNum = allNumbers[0] !== undefined ? allNumbers[0] : 5;
        let baseMatchedNumbers = [];

        if (predResult === "BIG") {
            if ([5, 0].includes(lastNum)) baseMatchedNumbers = [6, 8];
            else if ([6, 1].includes(lastNum)) baseMatchedNumbers = [7, 9];
            else if ([7, 2].includes(lastNum)) baseMatchedNumbers = [5, 8];
            else if ([8, 3].includes(lastNum)) baseMatchedNumbers = [6, 9];
            else baseMatchedNumbers = [7, 8];
        } else {
            if ([0, 5].includes(lastNum)) baseMatchedNumbers = [1, 3];
            else if ([1, 6].includes(lastNum)) baseMatchedNumbers = [0, 2];
            else if ([2, 7].includes(lastNum)) baseMatchedNumbers = [1, 4];
            else if ([3, 8].includes(lastNum)) baseMatchedNumbers = [0, 3];
            else baseMatchedNumbers = [1, 2];
        }

        let matchedNumbers = [...baseMatchedNumbers];
        let counts = {};
        baseMatchedNumbers.forEach(n => counts[n] = 0);

        for (let i = 0; i < history.length - 1; i++) {
            let currN = parseInt(history[i].number !== undefined ? history[i].number : history[i].result);
            let nextN = parseInt(history[i+1].number !== undefined ? history[i+1].number : history[i+1].result);
            if (currN === lastNum && baseMatchedNumbers.includes(nextN)) {
                counts[nextN]++;
            }
        }
        matchedNumbers.sort((a, b) => counts[b] - counts[a]);

        let numbersStr = matchedNumbers.join(", ");
        let colorStr = predResult === "BIG" ? "🟢 GREEN" : "🔴 RED";
        if (matchedNumbers.includes(0)) colorStr = "🔴 RED / 🟣 VIOLET";
        else if (matchedNumbers.includes(5)) colorStr = "🟢 GREEN / 🟣 VIOLET";

        return { predResult, targetNumbers: matchedNumbers, numbersStr, colorStr };
    } catch (e) {
        return { predResult: "BIG", targetNumbers: [6, 8], numbersStr: "6, 8", colorStr: "🟢 GREEN" };
    }
}

app.get('/', (req, res) => res.send('WinGo 30S Dragon Bot Active!'));

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
        let dynamicStatusMsg = "";

        if (lastPredictedPeriod && lastPredictedPeriod === actualPeriod) {
            let isResultHit = (lastPredictedResult === actualResult);
            let isNumberHit = lastPredictedNumbers.includes(actualNum);
            let currentBetVal = getBetVal(maintenanceLevel);

            if (maintenanceLevel > maxLevelReached) maxLevelReached = maintenanceLevel;
            predictionCount++;

            if (isResultHit) {
                totalWins++;
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
                maintenanceLevel = 1; // Reset back to Level 1 on Win
            } else {
                totalLosses++;
                totalProfitLoss -= currentBetVal;
                
                // STRICT CAPPING: Never exceed Level 4! If Level 4 fails, reset to Level 1 safely.
                if (maintenanceLevel >= 4) {
                    dynamicStatusMsg = `💔 **LOSS AT LEVEL 4: ${actualResult} (${actualNum})**\n🛡️ **SAFETY RESET: RESTARTING FROM LEVEL 1**`;
                    maintenanceLevel = 1;
                } else {
                    maintenanceLevel++;
                    dynamicStatusMsg = `💔 **LOSS: ${actualResult} (${actualNum} - ${actualColor})**\n➡️ **NEXT LEVEL (LEVEL ${maintenanceLevel})**`;
                }
            }

            if (predictionCount >= 60) {
                let profitSign = totalProfitLoss >= 0 ? "₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);
                let summaryMsg = "👑 **DRAGON KING MASTER** 👑\n\n" +
                                 "📊 **60 PREDICTIONS BATCH SUMMARY REPORT** 📊\n" +
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
                levelWins = { 1: 0, 2: 0, 3: 0, 4: 0 };
            }
        }

        if (nextPeriod !== lastSentPeriod) {
            let pred = dragonBlockPatternEngine(list);
            let currentBetName = levelData[maintenanceLevel]?.name || ("₹" + getBetVal(maintenanceLevel));
            let profitSign = totalProfitLoss >= 0 ? "₹" + totalProfitLoss.toFixed(2) : "-₹" + Math.abs(totalProfitLoss).toFixed(2);

            let msg = "🔥 **WINGO 30S DRAGON PREDICTION** 🔥\n" +
                      "━━━━━━━━━━━━━━━━━━━━━\n" +
                      "📌 **PERIOD:** `" + nextPeriod + "`\n" +
                      "🎲 **BET:** **" + pred.predResult + "**\n" +
                      "🔢 **PRED NO:** `" + pred.numbersStr + "`\n" +
                      "🎨 **COLOUR:** " + pred.colorStr + "\n" +
                      "💰 **BET LEVEL AMT:** **LEVEL " + maintenanceLevel + " (" + currentBetName + ")** [MAX: L4]\n" +
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
                   "━━━━━━━━━━━━━━━━━━━━━\n\n" +
                   "🔗 **Register Link:**\n" + REGISTER_LINK;

            await bot.sendMessage(MAIN_CHANNEL, msg, { parse_mode: 'Markdown' });

            lastSentPeriod = nextPeriod;
            lastPredictedPeriod = nextPeriod;
            lastPredictedResult = pred.predResult;
            lastPredictedNumbers = pred.targetNumbers;
        }
    } catch (e) { console.error("Error:", e.message); }
}

async function startContinuousLoop() { while (true) { await fetchWinGoData(); await new Promise(r => setTimeout(r, 6000)); } }

app.listen(PORT, '0.0.0.0', () => { 
    console.log("Dragon Bot Active on port " + PORT); 
    startContinuousLoop(); 
});
