// 🎯 ADVANCED PATTERN & COLOUR FIRST ENGINE (Custom Rules)
function highAccuracyEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "BIG" : "SMALL");

        let last10 = allResults.slice(0, 10);
        let predResult = "BIG";

        // 1. DRAGON STREAK (Thodarnthu 3+ ore result vandha adhe follow pannu)
        if (last10[0] === last10[1] && last10[1] === last10[2]) {
            predResult = last10[0];
        } 
        // 2. MIRROR / ZIG-ZAG PATTERN (B, S, B, S -> Next Reverse)
        else if (last10[0] !== last10[1] && last10[1] !== last10[2] && last10[2] !== last10[3]) {
            predResult = last10[0] === "BIG" ? "SMALL" : "BIG";
        } 
        // 3. 1-2 PATTERN CHECK (B, S, S -> Expect B | S, B, B -> Expect S)
        else if (last10[1] === last10[2] && last10[0] !== last10[1]) {
            predResult = last10[1] === "BIG" ? "SMALL" : "BIG";
        }
        // 4. MAJORITY WEIGHTED FALLBACK (Last 10-la edhu jaasthi irukko)
        else {
            let countB = last10.filter(x => x === "BIG").length;
            predResult = countB >= 5 ? "BIG" : "SMALL";
        }

        // 5. COLOUR FIRST & NUMBER MAPPING LOGIC
        // Recent numbers-a base panni high frequency number-a priority panrom
        let candidateNums = predResult === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
        let recent15 = allNumbers.slice(0, 15);
        let freqMap = {};
        
        candidateNums.forEach(n => freqMap[n] = 0);
        recent15.forEach((n, idx) => {
            if (candidateNums.includes(n)) {
                freqMap[n] += (15 - idx); // Recent numbers-ukku weightage adhigam
            }
        });

        let sortedCandidates = candidateNums.sort((a, b) => freqMap[b] - freqMap[a]);
        let targetNumbers = [sortedCandidates[0], sortedCandidates[1]];

        // Primary Colour determination
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
