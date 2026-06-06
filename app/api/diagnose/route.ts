import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/diagnose
 * Server-side proxy to Gemini 2.5 Flash for plant disease diagnosis.
 * Keeps API key secret on the server, never exposed to client.
 *
 * Body: { imageBase64: string, mimeType: string, plantName: string }
 */

interface DiagnosisResult {
  disease: string
  severity: 'mild' | 'moderate' | 'severe'
  treatments: string[]
  confidence: number
  isHealthy: boolean
}

/** Gemini có thể tách nội dung qua nhiều `parts`; phải nối hết trước khi parse JSON. */
function textFromCandidate(candidate: {
  content?: { parts?: { text?: string }[] }
}): string {
  const parts = candidate?.content?.parts ?? []
  return parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim()
}

/** Schema cho JSON mode — giảm lỗi cắt nửa chừng / markdown so với chỉ nhắc trong prompt. */
const diagnosisResponseSchema = {
  type: 'OBJECT',
  properties: {
    disease: { type: 'STRING' },
    severity: {
      type: 'STRING',
      description: 'Exactly one of: mild, moderate, severe',
    },
    treatments: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    confidence: { type: 'NUMBER' },
    isHealthy: { type: 'BOOLEAN' },
  },
  required: ['disease', 'severity', 'treatments', 'confidence', 'isHealthy'],
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType, plantName } = await request.json()

    if (!imageBase64 || !plantName) {
      return NextResponse.json(
        { error: 'Missing imageBase64 or plantName' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured. Add it to .env.local' },
        { status: 500 }
      )
    }

    const systemPrompt = `
You are an expert plant pathologist and agronomist with extensive experience in visual plant disease diagnosis.

Your task:
Analyze the provided image thoroughly for ANY signs of plant disease, stress, nutrient deficiency, pest damage, or environmental damage. Be proactive in detecting issues — even subtle early-stage symptoms matter.

Plant name claimed by user: "${plantName}".

CRITICAL DIAGNOSTIC GUIDELINES:
1. ALWAYS attempt a diagnosis. Even if the image is not perfect, provide your best assessment based on visible clues.
2. Look carefully for: discoloration, spots, wilting, curling, yellowing, browning edges, holes, mold/fungus, unusual textures, stunted growth, drooping.
3. Consider common diseases for the claimed plant species. If you see even slight symptoms matching a known disease, report it.
4. Only return "Unknown" if the image contains NO plant material at all (e.g., a photo of a wall or person).
5. If the plant looks mostly healthy but has minor issues (slight yellowing, small spots), report those issues — do NOT just say "Healthy".
6. For blurry or distant images, still attempt diagnosis based on what you CAN see (color patterns, overall shape, visible damage).

Severity guidelines:
- "mild": early signs, minor discoloration, few spots, slight wilting
- "moderate": spreading symptoms, noticeable damage, multiple affected areas
- "severe": widespread damage, significant wilting, heavy infestation

Confidence scale:
- 0.3-0.5: low quality image but symptoms visible
- 0.5-0.7: reasonable image, likely diagnosis
- 0.7-0.85: clear symptoms visible
- 0.85-1.0: textbook-level clear visual evidence

Treatment guidelines:
- Provide 3-5 actionable treatment steps
- Start with immediate actions (isolate, remove affected parts)
- Include preventive measures
- Suggest organic/natural remedies first
- For chemical treatments, recommend consulting local agricultural guidance

Return JSON exactly in this structure:
{
  "disease": "English disease name or Healthy",
  "severity": "mild | moderate | severe",
  "treatments": ["step 1", "step 2", "step 3"],
  "confidence": 0.0,
  "isHealthy": false
}
`.trim()

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: imageBase64,
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
            // Enable thinking for better analysis quality
            thinkingConfig: { thinkingBudget: 1024 },
            responseMimeType: 'application/json',
            responseSchema: diagnosisResponseSchema,
          },
        }),
        signal: AbortSignal.timeout(30000), // 30s timeout (thinking needs more time)
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('Gemini API error:', response.status, errText)
      return NextResponse.json(
        { error: `Gemini API error: ${response.status}` },
        { status: 502 }
      )
    }

    const data = await response.json()

    const candidate = data.candidates?.[0]
    const finishReason = candidate?.finishReason as string | undefined
    const rawText = textFromCandidate(candidate ?? {})

    if (!rawText) {
      console.error(
        'Gemini trả về rỗng. finishReason:',
        finishReason,
        'raw:',
        JSON.stringify(data).slice(0, 2000)
      )
      throw new Error('Gemini không trả về nội dung')
    }

    const cleanJson = rawText.replace(/```json|```/g, '').trim()

    let result: DiagnosisResult
    try {
      result = JSON.parse(cleanJson) as DiagnosisResult
    } catch {
      console.error(
        'JSON.parse thất bại. finishReason:',
        finishReason,
        'raw text:',
        rawText
      )
      if (finishReason === 'MAX_TOKENS') {
        throw new Error(
          'Phản hồi AI bị cắt (MAX_TOKENS). Hãy thử lại hoặc báo lỗi nếu vẫn lặp lại.'
        )
      }
      throw new Error('Response không phải JSON hợp lệ')
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Diagnosis error:', error)

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'AI returned an invalid result. Please try again.' },
        { status: 500 }
      )
    }

    if (error instanceof Error) {
      const m = error.message
      if (
        m === 'Response không phải JSON hợp lệ' ||
        m === 'Gemini không trả về nội dung' ||
        m.startsWith('Phản hồi AI bị cắt')
      ) {
        return NextResponse.json({ error: m }, { status: 500 })
      }
    }

    return NextResponse.json(
      { error: 'Could not connect to AI. Please try again later.' },
      { status: 500 }
    )
  }
}
