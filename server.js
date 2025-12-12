import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3000;

// 🔑 PEGA TU API KEY REAL AQUÍ
const DEEPSEEK_API_KEY = 'sk-d151cb31560d4023ad96516531ca9efb';

// Fix __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json());

// Servir frontend (carpeta raíz 247)
app.use(express.static(__dirname));

// Endpoint IA
app.post('/api/generar-rutina', async (req, res) => {
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    console.log('Respuesta DeepSeek:', JSON.stringify(data, null, 2));

    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(500).json({
        error: 'Respuesta inválida de DeepSeek',
        raw: data
      });
    }

    res.json(data);

  } catch (err) {
    console.error('Error backend:', err);
    res.status(500).json({ error: 'Error al contactar IA' });
  }
});

// ⚠️ IMPORTANTE: escuchar en TODAS las interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend activo en http://localhost:${PORT}`);
});

