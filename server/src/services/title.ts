/**
 * Generates a brief chat title from a user message using the LLM.
 * Runs as a non-streaming LLM call before the tool call loop.
 */

export async function generateChatTitle(
  userMessage: string,
  openAiEndpoint: string,
  model: string,
  maxRetries = 1,
): Promise<string | null> {
  const systemPrompt =
    'Generate a brief 1-4 word title for this chat based on the user\'s message. Return ONLY the title, no explanation, no quotes.'

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${openAiEndpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 20,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        console.warn(`Title generation failed (attempt ${attempt + 1}): ${response.status} - ${errorBody}`)
        if (attempt < maxRetries) continue
        return null
      }

      const data = await response.json()
      const title = data?.choices?.[0]?.message?.content?.trim()

      if (title) {
        return title
      }
    } catch (err) {
      console.warn(`Title generation error (attempt ${attempt + 1}):`, err)
      if (attempt < maxRetries) continue
      return null
    }
  }

  return null
}
