import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { GoogleGenAI } from '@google/genai'
import { extractText } from 'unpdf'

type Bindings = {
  GEMINI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(arrayBuffer), { mergePages: true });
  return text;
}

// ringkas PDF (AI)
app.post('/api/summarize', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File;

    if (!file) {
      return c.json({ error: 'File PDF wajib diunggah' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfText = await extractTextFromPdf(arrayBuffer);

    if (!pdfText.trim()) {
      return c.json({ error: 'Teks dalam PDF tidak terbaca atau kosong' }, 400);
    }

    const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Buatkan ringkasan yang terstruktur, rapi dan poin-poin penting dari teks berikut dalam Bahasa Indonesia:\n\n${pdfText}`,
    });

    return c.json({ summary: response.text });
  } catch (err: any) {
    return c.json({ error: err.message || 'Gagal memproses PDF' }, 500);
  }
});

// Terjemahan PDF
app.post('/api/translate', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File;
    const targetLang = (formData['targetLang'] as string) || 'Indonesia';

    if (!file) {
      return c.json({ error: 'File PDF wajib diunggah' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfText = await extractTextFromPdf(arrayBuffer);

    if (!pdfText.trim()) {
      return c.json({ error: 'Teks dalam PDF tidak terbaca atau kosong' }, 400);
    }

    const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Terjemahkan teks PDF berikut ke dalam bahasa ${targetLang}. Pertahankan struktur paragraf aslinya:\n\n${pdfText}`,
    });

    return c.json({ translation: response.text });
  } catch (err: any) {
    return c.json({ error: err.message || 'Gagal memproses terjemahan' }, 500);
  }
});

export default app
