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
You are a plant disease diagnosis expert.
Analyze the plant leaf image and return JSON with the following structure (NO markdown, NO backticks):
{
  "disease": "disease name in English, or 'Healthy' if no disease is found",
  "severity": "mild | moderate | severe",
  "treatments": ["step 1", "step 2", "step 3"],
  "confidence": 0.0-1.0,
  "isHealthy": true | false
}
Plant name: ${plantName}.
If the image is not a plant leaf, return { "disease": "Not a leaf image", "severity": "mild", "treatments": ["Please take a photo of a plant leaf"], "confidence": 0, "isHealthy": false }.
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
            maxOutputTokens: 1024
          }
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

    // Thêm dòng này — log toàn bộ response để debug
    console.log('Gemini raw response:', JSON.stringify(data, null, 2))

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Kiểm tra Gemini có trả về gì không trước khi parse
    if (!rawText) {
      console.error('Gemini trả về rỗng. Finish reason:', 
        data.candidates?.[0]?.finishReason)
      // finishReason: "MAX_TOKENS" = bị cắt, "SAFETY" = bị chặn bởi safety filter
      throw new Error('Gemini không trả về nội dung')
    }

    const cleanJson = rawText.replace(/```json|```/g, '').trim()

    // Bọc JSON.parse trong try/catch riêng để biết chính xác lỗi
    let result: DiagnosisResult
    try {
      result = JSON.parse(cleanJson)
    } catch (parseError) {
      console.error('JSON.parse thất bại. Raw text nhận được:', rawText)
      // In ra để biết Gemini đang trả về gì thực sự
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

    return NextResponse.json(
      { error: 'Could not connect to AI. Please try again later.' },
      { status: 500 }
    )
  }
}
