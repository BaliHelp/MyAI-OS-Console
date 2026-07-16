import fs from "fs";
import path from "path";

const key = "sk_visas_a8f3_seedkey1";
const url = "http://localhost:3000/api/v1/chat/completions";

async function testField(fieldName: string) {
  console.log(`\n--- Testing routing for field: ${fieldName} ---`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        field: fieldName,
        messages: [{ role: "user", content: "Halo, apa kabar?" }]
      })
    });

    console.log(`Status: ${res.status}`);
    const json = await res.json();
    console.log("Response:", JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.error("Request failed:", err.message);
  }
}

async function test400Error() {
  console.log(`\n--- Testing 400 error handling (should not disable keys) ---`);
  try {
    // Making a request with missing prompt/messages
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        field: "chatbot"
        // missing prompt/messages to trigger 400 validation error
      })
    });

    console.log(`Status: ${res.status}`);
    const json = await res.json();
    console.log("Response:", JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.error("Request failed:", err.message);
  }
}

async function run() {
  await testField("ocr_id_document"); // should route to Gemini (tier 1)
  await testField("orchestrator");   // should route to Claude (tier 1)
  await testField("chatbot");        // should route to GPT (tier 1)
  await test400Error();              // should return 400 error immediately
}

run();
