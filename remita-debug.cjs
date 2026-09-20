const fetch = require("node-fetch");

const publicKey = process.env.REMITA_PUBLIC_KEY;

const requestId = `FNPH-DEBUG-${Date.now()}`;

const url =
  "https://demo.remita.net/remita/exapp/api/v1/send/api/bgatesvc/billing/billers";

console.log("URL:", url);
console.log("Request ID:", requestId);
console.log("Public key loaded:", !!publicKey);

(async () => {
    try {
        console.log("\nSending request...\n");

        const response = await fetch(url, {
            method: "GET",
            timeout: 30000,
            headers: {
                transactionId: requestId,
                publicKey: publicKey,
                "Content-Type": "application/json"
            }
        });

        console.log("HTTP STATUS:", response.status);
        console.log("HTTP STATUS TEXT:", response.statusText);

        const text = await response.text();

        console.log("\nRAW RESPONSE:");
        console.log(text);

        console.log("\nRESPONSE HEADERS:");
        for (const [key, value] of response.headers.entries()) {
            console.log(`${key}: ${value}`);
        }

    } catch (error) {
        console.log("\n=== REAL NODE ERROR ===");
        console.error(error);
        console.log("\nError code:", error.code);
        console.log("Error message:", error.message);
        console.log("Error stack:", error.stack);
    }
})();