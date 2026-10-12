import { Module } from '@nestjs/common';
import { MENU_EXTRACTOR, MockMenuExtractor } from './menu-extractor.js';
import { GeminiMenuExtractor } from './gemini-menu-extractor.js';
@Module({
  providers: [
    {
      provide: MENU_EXTRACTOR,
      useFactory: () => {
        const mode = process.env.MENU_EXTRACTOR ?? 'mock';
        if (mode === 'mock') return new MockMenuExtractor();
        if (mode === 'gemini') return new GeminiMenuExtractor();
        throw new Error('MENU_EXTRACTOR must be mock or gemini');
      },
    },
  ],
  exports: [MENU_EXTRACTOR],
})
export class ExtractionModule {}
