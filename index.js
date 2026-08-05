// Pattern-Based Engine with Colour-First Logic
function patternEngine(history) {
    try {
        let allNumbers = history.map(x => parseInt(x.number !== undefined ? x.number : x.result));
        let allResults = allNumbers.map(n => n >= 5 ? "BIG" : "SMALL");

        let last10 = allResults.slice(0, 10);
        let predResult = "BIG";

        // 1. Dragon Check (3+ Consecutive Same Results)
        if (last10[0] === last10[1] && last10[1] === last10[2]) {
            predResult = last10[0]; // Follow Dragon
        }
        // 2. Mirror/Alternate Check (B, S, B, S)
        else if (last10[0] !== last10[1] && last10[1] !== last10[2] && last10[2] !== last10[3]) {
            predResult = last10[0] === "BIG" ? "SMALL" : "BIG"; // Reverse Last
        }
        // 3. 1-2 Pattern Check (B, S, S, B, S, S)
        else if (last10[0] === "SMALL" && last10[1] === "SMALL" && last10[2] === "BIG") {
            predResult = "BIG";
        }
        else {
            // Majority Fallback
            let bigCount = last10.filter(x => x === "BIG").length;
            predResult = bigCount >= 5 ? "BIG" : "SMALL";
        }

        // Colour & Number Mapping
        let mainColor = predResult === "BIG" ? "GREEN" : "RED";
        
        // Filter target numbers based on Colour + Big/Small
        let targetNumbers = [];
        if (predResult === "BIG" && mainColor === "GREEN") {
            targetNumbers = [7, 9]; // Primary Green Big
        } else if (predResult === "BIG" && mainColor === "RED") {
            targetNumbers = [6, 8]; // Primary Red Big
        } else if (predResult === "SMALL" && mainColor === "GREEN") {
            targetNumbers = [1, 3]; // Primary Green Small
        } else {
            targetNumbers = [2, 4]; // Primary Red Small
        }

        let colorStr = mainColor === "GREEN" ? "🟢 GREEN" : "🔴 RED";

        return { predResult, targetNumbers, colorStr, mainColorType: mainColor };

    } catch (e) {
        return { predResult: "BIG", targetNumbers: [7, 9], colorStr: "🟢 GREEN", mainColorType: "GREEN" };
    }
}
