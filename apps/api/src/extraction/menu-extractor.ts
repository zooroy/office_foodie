import type { ExtractedItem } from '@office-foodie/shared';
export const MENU_EXTRACTOR = Symbol('MENU_EXTRACTOR');
export interface MenuExtractor {
  extract(images: Buffer[], mimeTypes: string[]): Promise<ExtractedItem[]>;
}
export class MockMenuExtractor implements MenuExtractor {
  async extract(): Promise<ExtractedItem[]> {
    return [
      { name: '排骨飯', price: 100, category: '便當', needsReview: false },
      { name: '雞腿飯', price: 120, category: '便當', needsReview: false },
      { name: '滷蛋', price: null, category: '配菜', needsReview: true },
    ];
  }
}
