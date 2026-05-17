
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function checkModels() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("Error: OPENROUTER_API_KEY is not set in .env.local");
    return;
  }

  console.log("Checking OpenRouter availability...");
  
  const modelName = "inclusionai/ring-2.6-1t:free";

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content: "test" }],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ [SUCCESS] Model "${modelName}" is available.`);
      console.log(`   Preview: ${data.choices[0].message.content.substring(0, 50)}...`);
    } else {
      const error = await response.json().catch(() => ({}));
      console.log(`❌ [FAILED]  Model "${modelName}": ${error.error?.message || "HTTP " + response.status}`);
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.log(`❌ [ERROR]   ${error.message}`);
  }
}

checkModels();
