import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const analyzeMarketAndTrade = async (symbol: string, ohlcvData: any[], hasOpenPosition: boolean) => {
  const setting = await prisma.setting.findUnique({ where: { id: "1" } });
  const apiKey = setting?.openaiKey;

  if (!apiKey) {
    return { action: 'HOLD', reasoning: 'OpenAI API key missing in Settings.' };
  }

  const openai = new OpenAI({ apiKey });

  // Format data for AI
  const dataString = ohlcvData.map(c => `Time: ${new Date(c.timestamp).toISOString()}, O: ${c.open}, H: ${c.high}, L: ${c.low}, C: ${c.close}, V: ${c.volume}`).join('\n');

  let positionContext = '';
  if (hasOpenPosition) {
    positionContext = `CRITICAL RULE: We currently OWN this coin. Your job is to decide whether to 'SELL' (take profit/stop loss) or 'HOLD'. You CANNOT output 'BUY'.`;
  } else {
    positionContext = `CRITICAL RULE: We currently DO NOT own this coin. Your job is to decide whether to 'BUY' (enter position) or 'HOLD'. You CANNOT output 'SELL' since we have nothing to sell.`;
  }

  const systemPrompt = `You are an AGGRESSIVE quantitative crypto day-trader.
Analyze the provided 1-hour OHLCV data for ${symbol}.
Your goal is to catch short-term price movements and small profit margins. Do NOT always default to HOLD. 
${positionContext}
If you see a good opportunity based on your rules, take a risk and act.
Only output 'HOLD' if the market is completely dead and flat. Be confident and take action.
Your output MUST be a strict JSON object with two keys:
1. "action": exactly "BUY", "SELL", or "HOLD".
2. "reasoning": a concise 2-sentence explanation of why, written STRICTLY IN TURKISH (TÜRKÇE).
Do not output any markdown formatting, only pure JSON.`;

  const userPrompt = `Recent OHLCV Data:\n${dataString}`;

  try {
    const aiModelName = setting?.aiModel || 'gpt-4o-mini';
    const response = await openai.chat.completions.create({
      model: aiModelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7, // Increased temperature for more aggressive/diverse decisions
    });

    const resultString = response.choices?.[0]?.message?.content || '{"action": "HOLD", "reasoning": "Failed to parse API response"}';

    // Clean up if AI still includes markdown
    const cleanJson = resultString.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Error with OpenAI:', error);
    return { action: 'HOLD', reasoning: 'Error communicating with AI.' };
  }
};
