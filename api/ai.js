const CATEGORIES = [
  "structural", "drivetrain", "electronics", "pneumatics",
  "fastener", "tool", "consumable", "cable", "bearing",
  "motor", "sensor", "other"
];

async function identifyItem(req, res) {
  const { imageUrl } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: 'Missing image URL' });

  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI API key not configured' });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `You are an FRC inventory assistant. Identify ALL items in this image.

Return ONLY valid JSON:
{
  "items": [
    {
      "name": "specific item name",
      "category": one of [${CATEGORIES.map(c=>`"${c}"`).join(", ")}],
      "description": "brief description including material, size, usage",
      "estimated_quantity": number,
      "tags": ["array", "of", "relevant", "tags"],
      "manufacturer": "or empty string",
      "part_number": "or empty string"
    }
  ]
}

List EVERY distinct item you see. Be specific about types: e.g. "1/4-20 x 1in Hex Bolt" not just "screw", "CIM Motor" not just "motor", "3/8in Hex Shaft 12in" not just "shaft". Include estimated quantity per item (how many of that item are visible). If unknown, use 1.` },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      }],
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  if (!response.ok) return res.status(500).json({ error: `Groq API error: ${data?.error?.message || JSON.stringify(data)}` });

  const content = data.choices?.[0]?.message?.content;
  if (!content) return res.status(500).json({ error: 'AI returned empty response' });

  const parsed = JSON.parse(content);
  const items = Array.isArray(parsed) ? parsed : (parsed.items || [parsed]);
  return res.status(200).json({ items });
}

async function extractBrands(req, res) {
  const { imageBase64, mimeType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Image required' });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } },
          { type: 'text', text: 'List all company names, brand names, or business names visible in this image. Return ONLY a JSON array of strings with the company names, nothing else. Example: ["Nike","Apple","Local Business"]. If none found, return [].' }
        ]
      }],
      max_tokens: 500,
      temperature: 0.1,
    })
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '[]';
  const brands = JSON.parse(text.replace(/```json|```/g, '').trim());
  res.status(200).json({ brands });
}

async function lookupSponsor(req, res) {
  const { company } = req.body;
  if (!company) return res.status(400).json({ error: 'Company name required' });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a research assistant helping an FRC robotics team find sponsorship contact info for companies. Given a company name, provide their sponsorship, donations, or community outreach contact email and phone number. Respond ONLY with a valid JSON object with keys: email, phone, notes. No markdown, no backticks, just raw JSON.' },
        { role: 'user', content: `Find sponsorship contact info for: ${company}` }
      ],
      temperature: 0.2,
      max_tokens: 300,
    })
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  res.status(200).json(parsed);
}

async function tracePitMap(req, res) {
  const { imageUrl } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: 'Missing image URL' });

  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI API key not configured on server' });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this pit map image. Find all pit numbers and their approximate locations as normalized coordinates (x, y from 0.0 to 1.0, where 0,0 is top-left). Return ONLY a JSON array of objects like this: [{"team": 123, "x": 0.45, "y": 0.12}, ...]. Do not include any markdown or explanation.' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      }],
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return res.status(500).json({ error: 'AI failed to analyze image' });

  const parsed = JSON.parse(content);
  const pits = Array.isArray(parsed) ? parsed : (parsed.pits || []);
  return res.status(200).json({ pits });
}

async function parseCSV(req, res) {
  const { csv, type } = req.body || {};
  if (!csv) return res.status(400).json({ error: 'CSV content required' });

  const calendarSchema = 'title (required), type (event/deadline/meeting/competition/other), date (YYYY-MM-DD required), end_date, time (HH:MM), end_time, description, all_day (true/false)';
  const tasksSchema = 'title (required), description, status (Backlog/To Do/In Progress/Review/Done), priority (Low/Medium/High/Critical), start_date (YYYY-MM-DD), start_time (HH:MM), due_date (YYYY-MM-DD), due_time (HH:MM), assigned_name, subteam';

  const schema = type === 'calendar' ? calendarSchema : tasksSchema;
  const systemPrompt = `You parse CSV data into FRC team management tool JSON. Return ONLY a JSON array of objects. Schema: ${schema}. Parse the CSV headers and map each row. Correct any common issues: "todo" → "To Do", "inprogress" → "In Progress", "high priority" → "High", date formats like "5/24/2026" → "2026-05-24". Skip malformed rows. No markdown, no backticks, just raw JSON array.`;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Parse this CSV into JSON:\n\n${csv}` }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  if (!response.ok) return res.status(500).json({ error: `Groq error: ${data?.error?.message}` });

  const content = data.choices?.[0]?.message?.content;
  if (!content) return res.status(500).json({ error: 'AI returned empty' });

  const parsed = JSON.parse(content);
  const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.events || parsed.tasks || []);
  return res.status(200).json({ items });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const path = req.url.split('/').pop().split('?')[0];

  try {
    switch (path) {
      case 'identify-item': return await identifyItem(req, res);
      case 'extract-brands': return await extractBrands(req, res);
      case 'lookup': return await lookupSponsor(req, res);
      case 'trace-pit-map': return await tracePitMap(req, res);
      case 'parse-csv': return await parseCSV(req, res);
      default: return res.status(404).json({ error: 'Unknown AI endpoint' });
    }
  } catch (err) {
    console.error(`AI error (${path}):`, err);
    return res.status(500).json({ error: String(err) });
  }
}
