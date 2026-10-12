import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ExtractionModule } from '../dist/extraction/extraction.module.js';
import {
  MENU_EXTRACTOR,
  MockMenuExtractor,
} from '../dist/extraction/menu-extractor.js';
import {
  GeminiMenuExtractor,
  parseGeminiResponse,
} from '../dist/extraction/gemini-menu-extractor.js';
const wrap = (items) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify({ items }) }] } }],
});
describe('menu extractor providers and Gemini response handling', () => {
  const originalMode = process.env.MENU_EXTRACTOR;
  const originalKey = process.env.GEMINI_API_KEY;
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalMode === undefined) delete process.env.MENU_EXTRACTOR;
    else process.env.MENU_EXTRACTOR = originalMode;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });
  it.each([
    ['mock', MockMenuExtractor],
    ['gemini', GeminiMenuExtractor],
  ])('injects %s provider', async (mode, klass) => {
    process.env.MENU_EXTRACTOR = mode;
    const module = await Test.createTestingModule({
      imports: [ExtractionModule],
    }).compile();
    expect(module.get(MENU_EXTRACTOR)).toBeInstanceOf(klass);
    await module.close();
  });
  it('returns mock menu without an API key', async () => {
    delete process.env.GEMINI_API_KEY;
    expect(await new MockMenuExtractor().extract()).toHaveLength(3);
  });
  it('retains uncertain prices for manual review', () => {
    expect(
      parseGeminiResponse(
        wrap([
          { name: '飯', price: 100 },
          { name: '蛋', price: '?' },
        ]),
      ),
    ).toEqual([
      { name: '飯', price: 100, category: null, needsReview: false },
      { name: '蛋', price: null, category: null, needsReview: true },
    ]);
  });
  it.each([{ items: [] }, { items: [{ name: '', price: 10 }] }])(
    'rejects unusable results %j',
    ({ items }) => {
      expect(() => parseGeminiResponse(wrap(items))).toThrow();
    },
  );
  it('sends inline images with structured JSON output and a 30-second timeout', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => wrap([{ name: '飯', price: 100 }]),
    });
    await new GeminiMenuExtractor().extract(
      [Buffer.from('image')],
      ['image/jpeg'],
    );
    const [, init] = fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(timeout).toHaveBeenCalledWith(30000);
    expect(body.contents[0].parts[1].inlineData.data).toBe(
      Buffer.from('image').toString('base64'),
    );
    expect(body.generationConfig.responseFormat.text.mimeType).toBe(
      'APPLICATION_JSON',
    );
  });
  it.each(['http', 'timeout', 'invalid'])(
    'maps %s failure to EXTRACTION_FAILED',
    async (kind) => {
      process.env.GEMINI_API_KEY = 'test-key';
      const fetch = jest.spyOn(globalThis, 'fetch');
      if (kind === 'timeout') fetch.mockRejectedValue(new Error('timeout'));
      else
        fetch.mockResolvedValue({
          ok: kind !== 'http',
          json: async () => ({}),
        });
      try {
        await new GeminiMenuExtractor().extract(
          [Buffer.from('image')],
          ['image/png'],
        );
        throw Error('must reject');
      } catch (error) {
        expect(error.getResponse().code).toBe('EXTRACTION_FAILED');
      }
    },
  );
});
