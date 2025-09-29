import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

// Model pricing (per 1M tokens)
const MODEL_PRICING = {
  'gpt-5': { input: 15.00, output: 60.00 },
  'gpt-5-mini': { input: 3.00, output: 12.00 },
  'gpt-5-nano': { input: 0.60, output: 2.40 },
  // Fallback for real models if needed
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-4-turbo-preview': { input: 10.00, output: 30.00 },
};

function calculateCost(model, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[model] || { input: 0, output: 0 };
  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;
  return inputCost + outputCost;
}

// SSE endpoint for streaming chat
app.get('/chat-stream', async (req, res) => {
  const { message, model } = req.query;
  
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  console.log(`Received streaming request for ${model}: ${message}`);

  try {
    // Map GPT-5 models to available alternatives if they fail
    const modelMap = {
      'gpt-5': 'gpt-4-turbo-preview',
      'gpt-5-mini': 'gpt-3.5-turbo', 
      'gpt-5-nano': 'gpt-3.5-turbo'
    };
    
    let actualModel = model;
    let stream;
    
    try {
      stream = await openai.chat.completions.create({
        model: model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: message }],
        stream: true,
      });
    } catch (modelError) {
      console.log(`Model ${model} not found, falling back to ${modelMap[model]}`);
      actualModel = modelMap[model] || 'gpt-3.5-turbo';
      stream = await openai.chat.completions.create({
        model: actualModel,
        messages: [{ role: 'user', content: message }],
        stream: true,
      });
    }

    let fullText = '';
    let tokenCount = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content !== undefined && content !== '') {
        fullText += content;
        tokenCount += content.split(' ').length; // Rough token estimate
        
        // Send the chunk to the client
        res.write(`data: ${JSON.stringify({ 
          type: 'chunk', 
          content 
        })}\n\n`);
      }
    }

    // Send final message with cost
    const cost = calculateCost(model, message.length / 4, tokenCount); // Rough estimates
    res.write(`data: ${JSON.stringify({ 
      type: 'done', 
      fullText,
      model,
      cost 
    })}\n\n`);

  } catch (error) {
    console.error('OpenAI API error:', error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: error.message 
    })}\n\n`);
  } finally {
    res.end();
  }
});

// Original non-streaming endpoint (kept for compatibility)
app.post('/chat', async (req, res) => {
  const { message, model } = req.body;
  console.log(`Received message for ${model}: ${message}`);

  try {
    const completion = await openai.chat.completions.create({
      model: model || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: message }],
    });

    const responseText = completion.choices[0].message.content;
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const cost = calculateCost(model, inputTokens, outputTokens);

    res.json({ 
      text: responseText,
      model: model,
      cost: cost
    });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
