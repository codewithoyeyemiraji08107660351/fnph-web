const {
    RemitaBillingGateway,
    GetBillerPayload,
    Credentials
} = require("remita-billing-gateway").RemitaService;

console.log("1. SDK loaded");

const publicKey = process.env.REMITA_PUBLIC_KEY;
const secretKey = process.env.REMITA_SECRET_KEY;

console.log("2. Public key loaded:", !!publicKey);
console.log("3. Secret key loaded:", !!secretKey);

if (!publicKey || !secretKey) {
    console.error("Missing Remita credentials.");
    process.exit(1);
}

const credentials = new Credentials(
    publicKey,
    secretKey,
    "DEMO",
    30000,
    30000
);

console.log("4. Credentials created");

const gateway = new RemitaBillingGateway(credentials);

console.log("5. Gateway created");

const requestId = `FNPH-${Date.now()}`;
const payload = new GetBillerPayload(requestId);

console.log("6. Request ID:", requestId);
console.log("7. Calling Remita getBillers()...");

gateway.getBillers(payload)
    .then((response) => {
        console.log("8. REMITA RESPONSE:");
        console.dir(response, { depth: null });
    })
    .catch((error) => {
        console.log("8. REMITA ERROR:");
        console.error(error);
    });