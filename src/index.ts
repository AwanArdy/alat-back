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
  const t0 = Date.now();
  console.log('[summarize] 1. request diterima');
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File;

    if (!file) {
      return c.json({ error: 'File PDF wajib diunggah' }, 400);
    }

    console.log(`[summarize] 2. file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    const arrayBuffer = await file.arrayBuffer();

    const tExtract = Date.now();
    const pdfText = await extractTextFromPdf(arrayBuffer);
    console.log(`[summarize] 3. ekstraksi PDF selesai (${Date.now() - tExtract} ms, teks: ${pdfText.length} karakter)`);

    if (!pdfText.trim()) {
      return c.json({ error: 'Teks dalam PDF tidak terbaca atau kosong' }, 400);
    }

    const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
    console.log(`[summarize] 4. memanggil Gemini (gemini-2.5-flash, prompt ${pdfText.length} karakter)...`);
    const tAi = Date.now();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Buatkan ringkasan yang terstruktur, rapi dan poin-poin penting dari teks berikut dalam Bahasa Indonesia:\n\n${pdfText}`,
    });
    console.log(`[summarize] 5. Gemini selesai (${Date.now() - tAi} ms), total request ${Date.now() - t0} ms`);

    return c.json({ summary: response.text });
  } catch (err: any) {
    console.error(`[summarize] error setelah ${Date.now() - t0} ms:`, err?.message, err?.status ?? err?.name ?? '');
    return c.json({ error: err.message || 'Gagal memproses PDF' }, 500);
  }
});

// Terjemahan PDF
app.post('/api/translate', async (c) => {
  const t0 = Date.now();
  console.log('[translate] 1. request diterima');
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File;
    const targetLang = (formData['targetLang'] as string) || 'Indonesia';

    if (!file) {
      return c.json({ error: 'File PDF wajib diunggah' }, 400);
    }

    console.log(`[translate] 2. file: ${file.name} (${(file.size / 1024).toFixed(1)} KB), target: ${targetLang}`);
    const arrayBuffer = await file.arrayBuffer();

    const tExtract = Date.now();
    const pdfText = await extractTextFromPdf(arrayBuffer);
    console.log(`[translate] 3. ekstraksi PDF selesai (${Date.now() - tExtract} ms, teks: ${pdfText.length} karakter)`);

    if (!pdfText.trim()) {
      return c.json({ error: 'Teks dalam PDF tidak terbaca atau kosong' }, 400);
    }

    const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
    console.log(`[translate] 4. memanggil Gemini (gemini-2.5-flash → ${targetLang}, prompt ${pdfText.length} karakter)...`);
    const tAi = Date.now();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Terjemahkan teks PDF berikut ke dalam bahasa ${targetLang}. Pertahankan struktur paragraf aslinya:\n\n${pdfText}`,
    });
    console.log(`[translate] 5. Gemini selesai (${Date.now() - tAi} ms), total request ${Date.now() - t0} ms`);

    return c.json({ translation: response.text });
  } catch (err: any) {
    console.error(`[translate] error setelah ${Date.now() - t0} ms:`, err?.message, err?.status ?? err?.name ?? '');
    return c.json({ error: err.message || 'Gagal memproses terjemahan' }, 500);
  }
});

export default app
