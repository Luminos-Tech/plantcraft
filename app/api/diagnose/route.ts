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
You are a cautious plant health assistant specializing in visual leaf disease screening.

Your task:
Analyze the provided image and the claimed plant name. Return ONLY valid JSON. No markdown, no explanations outside JSON.

Important rules:
- Do not guess a specific disease when visual evidence is insufficient.
- If the image is blurry, too dark, too far away, not a leaf, or symptoms are unclear, return "Unknown / insufficient image quality".
- If the plant appears healthy, set disease to "Healthy", isHealthy to true, severity to "none", and treatments to basic care tips.
- If the plant name does not seem consistent with the image, mention that in notes.
- Prefer practical, low-risk treatments first: isolate affected plant, remove damaged leaves, improve airflow, avoid overwatering, monitor progression.
- Do not give exact pesticide or fungicide dosage. Recommend consulting local agricultural guidance for chemical treatments.
- Confidence must reflect image quality and symptom clarity:
  - 0.0-0.3: not a leaf, unusable image, or impossible to determine
  - 0.4-0.6: possible issue but uncertain
  - 0.7-0.85: likely diagnosis
  - 0.86-1.0: very clear visual evidence

Return JSON exactly in this structure:
{
  "disease": "English disease name, Healthy, Not a leaf image, or Unknown / insufficient image quality",
  "severity": "none | mild | moderate | severe | unknown",
  "treatments": ["step 1", "step 2", "step 3"],
  "confidence": 0.0,
  "isHealthy": false,
  "notes": "short explanation of key visible symptoms or uncertainty"
}

Plant name claimed by user: "${plantName}".
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
            temperature: 0.1,
            // Gemini 2.5: thinking + text cùng trần maxOutputTokens — giữ cao + tắt thinking.
            maxOutputTokens: 8192,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
            responseSchema: diagnosisResponseSchema,
          },
        }),
        signal: AbortSignal.timeout(15000), // 15s timeout
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
