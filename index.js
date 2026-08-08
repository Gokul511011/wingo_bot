async function fetchWinGoData() {
    try {
        let parsedData = await httpFetch(TARGET_URL);

        // API Response-ஐ Logs-ல் சரிபார்க்க
        console.log("RAW API RESPONSE:", JSON.stringify(parsedData).slice(0, 300));

        if (!parsedData) {
            console.log("Empty Response, retrying...");
            return;
        }

        let list = parsedData?.data?.list || parsedData?.list || (Array.isArray(parsedData) ? parsedData : null);

        if (!list || !Array.isArray(list) || list.length === 0) {
            console.log("Data list is empty, retrying...");
            return;
        }

        console.log("SUCCESS! Data Fetched via API. Total Records:", list.length);

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

                await bot.sendMessage(CHANNEL_ID, summaryMsg, { parse_mode: 'Markdown' });

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

            await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });

            lastSentPeriod = nextPeriod;
            lastPredictedPeriod = nextPeriod;
            lastPredictedResult = pred.predResult;
            lastPredictedNumbers = pred.targetNumbers;
            lastPredictedColor = pred.mainColor;
            console.log("[CONTINUOUS] Sent Period: " + nextPeriod + " (" + predictionCount + "/60)");
        }
    } catch (error) {
        console.error('[API FETCH ERROR]:', error.message);
    }
}
