// ... existing code ...
        if (nextPeriod !== lastSentPeriod) {
            // Duplicate Send ஆகாமல் தடுக்க Lock
            lastSentPeriod = nextPeriod; 

            let pred = deepHistoryPatternEngine(list, maintenanceLevel);
            
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

            lastPredictedPeriod = nextPeriod;
            lastPredictedResult = pred.predResult;
            lastPredictedNumbers = pred.targetNumbers;
            lastPredictedColor = pred.mainColor;
            console.log("[ULTRA FAST] Sent Period: " + nextPeriod + " (" + predictionCount + "/60)");
        }
// ... existing code ...
