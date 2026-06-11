import OpenAI from "openai";

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // ← remove when Cloud Function is ready
});

const SYSTEM_PROMPT = `You are a helpful assistant for a Chartered Accountant (CA) firm in India.
You only answer questions related to:
- Indian Income Tax (ITR filing, tax slabs, deductions, TDS)
- GST (registration, returns, GSTR forms, ITC)
- TDS and TCS rules
- Company registration and compliance (ROC, MCA)
- Accounting standards and bookkeeping
- The firm's general services

If a question is outside these topics, politely say:
"This is outside my scope. Please contact our CA team directly for assistance."

Always be professional, concise, and accurate. Use simple language.`;

export const getChatResponse = async (messages) => {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ],
    max_tokens: 500,
    temperature: 0.4,
  });
  return response.choices[0].message.content;
};
