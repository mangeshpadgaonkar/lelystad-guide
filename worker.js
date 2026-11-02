export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/chat' && request.method === 'POST') {
      try {
        const { question } = await request.json();

        if (!question || question.trim().length === 0) {
          return new Response(JSON.stringify({ error: 'No question provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Load listings from static asset
        const dataRes = await env.ASSETS.fetch(new Request('https://placeholder/data.json'));
        const data = await dataRes.json();

        // Build context string from listings
        const context = data.sections.map(section => {
          const entries = section.entries.map(e => {
            let line = `- ${e.name}: ${e.desc}`;
            if (e.phone) line += ` Phone: ${e.phone}.`;
            if (e.website) line += ` Website: ${e.website}.`;
            if (e.tags) line += ` Tags: ${e.tags.join(', ')}.`;
            return line;
          }).join('\n');
          return `## ${section.title}\n${entries}`;
        }).join('\n\n');

        const systemPrompt = `You are a helpful assistant for the Indian community in Lelystad, Netherlands.
You help people find local services, food, tradespeople, and activities based on the community guide below.
Answer in a friendly, concise way. If the information is in the guide, share it clearly including phone numbers and websites.
If something is not in the guide, say so honestly and suggest they ask in the Lelystad Indian community WhatsApp group.
Always respond in the same language the user writes in (English, Dutch, or Hindi).

COMMUNITY GUIDE DATA:
${context}`;

        const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question.trim() },
          ],
          max_tokens: 512,
        });

        return new Response(JSON.stringify({ answer: response.response }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Serve static assets for everything else
    return env.ASSETS.fetch(request);
  },
};
