import 'reflect-metadata';
import { describe, it, expect } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../dist/common/zod-validation.pipe.js';

class Input {
  static schema = z.object({
    name: z.string().trim().min(1),
    quantity: z.number().int().min(1).max(99),
  });
}

describe('Global zod validation', () => {
  const pipe = new ZodValidationPipe();
  const metadata = { type: 'body', metatype: Input };

  it('returns the parsed and normalized input', () => {
    expect(pipe.transform({ name: ' 午餐 ', quantity: 2 }, metadata)).toEqual({
      name: '午餐',
      quantity: 2,
    });
  });

  it.each([0, 100, 1.5])('rejects invalid quantity %s', (quantity) => {
    expect(() => pipe.transform({ name: '午餐', quantity }, metadata)).toThrow(
      BadRequestException,
    );
    try {
      pipe.transform({ name: '午餐', quantity }, metadata);
    } catch (error) {
      expect(error.getResponse()).toEqual({
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
      });
    }
  });

  it('rejects a blank name', () => {
    expect(() => pipe.transform({ name: '  ', quantity: 1 }, metadata)).toThrow(
      BadRequestException,
    );
  });
});
