require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const port = 3001;

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('OPENAI_API_KEY is not set in the .env file or the file is not being read correctly.');
}

const openai = new OpenAI({
  apiKey: apiKey,
});

// Hypothetical pricing per million tokens (input/output)
const PRICING = {
  'gpt-5': { input: 10.00, output: 30.00 },
  'gpt-5-mini': { input: 1.00, output: 2.00 },
  'gpt-5-nano': { input: 0.25, output: 0.50 },
};

app.use(cors());
app.use(express.json());

app.post('/chat', async (req, res) => {
  try {
    const { message, model } = req.body;
    console.log(`Received message for ${model}:`, message);

    if (!message || !model) {
      return res.status(400).json({ error: 'Message and model are required.' });
    }

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: message }],
      model: model,
    });

    const usage = completion.usage;
    let cost = 0;
    if (usage && PRICING[model]) {
      const { prompt_tokens, completion_tokens } = usage;
      const { input: inputPrice, output: outputPrice } = PRICING[model];
      cost = ((prompt_tokens / 1000000) * inputPrice) + ((completion_tokens / 1000000) * outputPrice);
    }

    const aiResponse = {
      sender: 'AI',
      text: completion.choices[0].message.content,
      model: model,
      cost: cost,
    };

    res.json(aiResponse);
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ error: 'Failed to get response from OpenAI.' });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
