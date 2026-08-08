async function fetchWinGoDataClean(browser) {
    let page = null;
    try {
        page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        // Direct JSON URL-க்கு பதிலாக Main Domain-க்கு செல்லவும்
        await page.goto('https://draw.ar-lottery01.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Cloudflare Challenge கடக்க 3 நொடிகள் காத்திருக்கவும்
        await new Promise(r => setTimeout(r, 3000));

        // Browser context-க்குள் இருந்து fetch 실행
        const parsedData = await page.evaluate(async () => {
            try {
                const res = await fetch('https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?pageSize=1000&pageNo=1');
                return await res.json();
            } catch (e) {
                return null;
            }
        });

        if (!parsedData) {
            console.log("Cloudflare bypass in progress / Waiting for JSON...");
            return;
        }

        let list = parsedData?.data?.list || parsedData?.list || (Array.isArray(parsedData) ? parsedData : null);

        if (!list || !Array.isArray(list) || list.length === 0) {
            console.log("Response fetched, but list is empty. Retrying...");
            return;
        }

        console.log("SUCCESS! Data Extracted Cleanly. Total Records:", list.length);
        // ... (மீதி code அப்படியே இருக்கட்டும்)
