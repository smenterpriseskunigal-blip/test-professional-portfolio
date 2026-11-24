import { GoogleGenAI, Type } from '@google/genai'

// 'gemini-4-hydrogen' (used before) is not a real model id, so every chat answer failed. Change this one line to switch models.
const GEMINI_MODEL = 'gemini-3.6-flash'

let client: GoogleGenAI | null = null
let cachedKey = ''

export function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }
  if (!client || cachedKey !== apiKey) {
    cachedKey = apiKey
    client = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: 22_000 },
    })
  }
  return client
}

export type GroundedReply = {
  canAnswer: boolean
  answer: string
  reason: string
}

function parseGroundedJson(raw: string): Partial<GroundedReply> {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(cleaned || '{}') as Partial<GroundedReply>
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as Partial<GroundedReply>
    }
    throw new Error('Malformed JSON response from Gemini')
  }
}

export async function generateGroundedResponse(params: {
  kbContext: string
  customInstructions: string
  history: { sender: string; body: string }[]
  question: string
  visitorName: string
  visitorRole: string
}): Promise<GroundedReply> {
  const ai = getGeminiClient()

  const systemInstruction = [
    "You are the official AI assistant on Yashwanth Gowda M's professional portfolio.",
    'STRICT GROUNDING RULE:',
    '1. You MUST answer visitor questions STRICTLY and EXCLUSIVELY using the provided KNOWLEDGE BASE below.',
    '2. NEVER invent, assume, extrapolate, or hallucinate any facts about Yashwanth (including salary expectations, notice period, exact age, personal contact numbers not in KB, private opinions, client names, or unstated skills/dates).',
    '3. If the visitor asks a factual question about Yashwanth that is NOT clearly and explicitly answered in the KNOWLEDGE BASE, you MUST set "canAnswer": false and "answer": "".',
    '4. Only simple conversational greetings or polite closings (e.g., "Hi", "Hello", "Thank you") may be answered warmly with "canAnswer": true while inviting them to ask about Yashwanth\'s background.',
    '5. When "canAnswer" is true, keep the answer concise, helpful, accurate, and completely faithful to the Knowledge Base.',
    params.customInstructions
      ? `\nCUSTOM INSTRUCTIONS FROM YASHWANTH:\n${params.customInstructions}`
      : '',
    `\nKNOWLEDGE BASE:\n${params.kbContext || '(The Knowledge Base is currently empty.)'}`,
  ]
    .filter(Boolean)
    .join('\n')

  const recentHistory = params.history
    .slice(-10)
    .map(m => `${m.sender}: ${m.body}`)
    .join('\n')

  const prompt = [
    `Visitor: ${params.visitorName} (${params.visitorRole})`,
    recentHistory ? `Recent conversation:\n${recentHistory}` : '',
    `Current visitor message: ${params.question}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const response = await Promise.race([
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            canAnswer: {
              type: Type.BOOLEAN,
              description:
                'True ONLY if the question is a simple greeting/closing or is directly answered by the Knowledge Base. False if any detail must be guessed or is missing from the Knowledge Base.',
            },
            answer: {
              type: Type.STRING,
              description: 'The strictly grounded answer when canAnswer is true; otherwise empty string.',
            },
            reason: {
              type: Type.STRING,
              description: 'Brief explanation of which KB section answered this or what fact is missing.',
            },
          },
          required: ['canAnswer', 'answer', 'reason'],
        },
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini request timed out after 25s')), 25_000)
    ),
  ])

  const raw = (response.text ?? '{}').trim()
  const parsed = parseGroundedJson(raw)
  const canAnswer = Boolean(parsed.canAnswer) && typeof parsed.answer === 'string' && parsed.answer.trim().length > 0
  return {
    canAnswer,
    answer: canAnswer ? String(parsed.answer).trim() : '',
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
  }
}
