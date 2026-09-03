import { describe, expect, it } from 'vitest';
import { EventTypeSchema, CardTypeSchema } from './enums';

describe('enums compartidos', () => {
  it('los 4 tipos de evento son los confirmados con el cliente', () => {
    expect(EventTypeSchema.options).toEqual(['QUINCE', 'EGRESO', 'BODA', 'EMPRESARIAL']);
  });

  it('el desglose de tarjetas es el mismo para los 4 tipos de evento', () => {
    expect(CardTypeSchema.options).toEqual(['ADULTO', 'ADOLESCENTE', 'MENOR', 'BRINDIS']);
  });
});
