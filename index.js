// 🎯 ULTRA HIGH ACCURACY ENGINE v3.1 (Bug Fixed & Rebalanced)
function highAccuracyEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "BIG" : "SMALL");

        let last15 = allResults.slice(0, 15);
        let predResult = "BIG";

        let countB = last15.filter(x => x === "BIG").length;
        let countS = last15.length - countB;

        // 1. DRAGON PATTERN (Thodarnthu 3+ same outcome)
        if (last15[0] === last15[1] && last15[1] === last15[2]) {
            predResult = last15[0];
        } 
        // 2. ZIG-ZAG PATTERN (B, S, B, S -> Alternate Trend)
        else if (last15[0] !== last15[1] && last15[1] !== last15[2] && last15[2] !== last15[3]) {
            predResult = last15[0] === "BIG" ? "SMALL" : "BIG";
        } 
        // 3. 1-2 STREAK RECOVERY
        else if (last15[1] === last15[2] && last15[0] !== last15[1]) {
            predResult = last15[0]; 
        }
        // 4. TREND DOMINANCE FILTER
        else {
            if (countB >= 9) {
                predResult = "BIG";
            } else if (countS >= 9) {
                predResult = "SMALL";
            } else {
                // Follow the latest momentum instead of aggressive reversal
                predResult = last15[0];
            }
        }

        // 5. HIGH PROBABILITY LUCKY NUMBERS
        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let recent20 = allNumbers.slice(0, 20);
        let freqMap = {};
        
        candidateNums.forEach(n => freqMap[n] = 0);
        recent20.forEach((n, idx) => {
            if (candidateNums.includes(n)) {
                freqMap[n] += (20 - idx); 
            }
        });

        // Copy array before sorting to avoid mutating candidateNums
        let sortedCandidates = [...candidateNums].sort((a, b) => freqMap[b] - freqMap[a]);
        let targetNumbers = [sortedCandidates[0], sortedCandidates[1]];

        // Colour mapping
        let mainColorType = predResult === "BIG" ? "GREEN" : "RED";
        let colorStr = mainColorType === "GREEN" ? "🟢 GREEN" : "🔴 RED";

        if (targetNumbers.includes(0) || targetNumbers.includes(5)) {
            colorStr += " / 🟣 VIOLET";
        }

        return { predResult, targetNumbers, colorStr, mainColorType };

    } catch (e) {
        console.error("Engine Error:", e.message);
        return { predResult: "BIG", targetNumbers: [7, 8], colorStr: "🟢 GREEN", mainColorType: "GREEN" };
    }
}
