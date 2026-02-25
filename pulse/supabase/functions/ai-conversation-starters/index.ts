import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  try {
    const { connectionName, recentActivity } = await req.json();

    const prompt = [
      'You are a warm, friendly assistant helping people stay connected.',
      `Generate 3 short, natural conversation starter questions for someone who wants to reconnect with ${connectionName ?? 'a friend'}.`,
      recentActivity ? `Recent context: ${recentActivity}` : '',
      'Return a JSON array of 3 strings. No extra text.',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '[]';
    const starters = JSON.parse(text);

    return new Response(JSON.stringify({ starters }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
