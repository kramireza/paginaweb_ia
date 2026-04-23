/*import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

============================
   Chatbot OpenAI
============================ 
app.post("/chat", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt vacío" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Eres un asistente académico de la carrera de Informática Administrativa de la UNAH."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7
    });

    res.json({
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: "Error al generar respuesta" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend activo en http://localhost:${PORT}`);
});*/

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

/* ============================
   Chatbot MOCK (temporal)
============================ */
app.post("/chat", async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "Mensaje vacío" });
    }

    // Respuesta simulada
    const mockResponse = generarRespuestaMock(prompt);

    res.json({
        reply: mockResponse
    });
});

/* ============================
   Lógica de respuestas MOCK
============================ */
function generarRespuestaMock(prompt) {
    const texto = prompt.toLowerCase();

    if (texto.includes("matricula")) {
        return "Para el proceso de matrícula debes revisar el calendario académico y cumplir con los requisitos previos de cada asignatura.";
    }

    if (texto.includes("docente") || texto.includes("profesor")) {
        return "Puedes consultar la información de los docentes en la sección de Docentes del sitio web.";
    }

    if (texto.includes("horario")) {
        return "Los horarios varían según el período académico y la modalidad de la asignatura.";
    }

    if (texto.includes("clases") || texto.includes("asignaturas")) {
        return "El plan de estudios de Informática Administrativa incluye asignaturas teóricas y prácticas distribuidas por períodos.";
    }

    return "Hola 👋 Soy el asistente virtual de Informática Administrativa. Estoy en modo demostración por el momento.";
}

app.listen(PORT, () => {
    console.log(`🚀 Backend MOCK activo en http://localhost:${PORT}`);
});
