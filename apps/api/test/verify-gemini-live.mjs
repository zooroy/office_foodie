import { readFile } from 'node:fs/promises';
import { GeminiMenuExtractor } from '../dist/extraction/gemini-menu-extractor.js';

const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (!response.ok) {
    const body = await response
      .clone()
      .json()
      .catch(() => ({}));
    console.log(
      JSON.stringify({
        providerStatus: response.status,
        providerError: body.error?.status,
        message: String(body.error?.message ?? '').replaceAll(
          process.env.GEMINI_API_KEY,
          '[redacted]',
        ),
      }),
    );
  }
  return response;
};
try {
  const items = await new GeminiMenuExtractor().extract(
    [await readFile('test/fixtures/sample-menu.png')],
    ['image/png'],
  );
  if (
    !items.some((item) => item.name === '排骨飯' && item.price === 110) ||
    !items.some((item) => item.name === '雞腿飯' && item.price === 120)
  ) {
    throw new Error('Expected sample menu names and prices were not extracted');
  }
  console.log(
    JSON.stringify({
      liveVerification: true,
      model: process.env.GEMINI_MODEL ?? 'gemini-3.8-flash',
      items,
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      liveVerification: false,
      code: error.getResponse?.().code ?? 'SAMPLE_MISMATCH',
    }),
  );
  process.exitCode = 1;
}
