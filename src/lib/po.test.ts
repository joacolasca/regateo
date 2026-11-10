import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildPurchaseOrder } from './po';

const input = {
  orderNo: 'RG-TEST',
  date: new Date('2026-11-10T12:00:00Z'),
  request: { product: 'vasos térmicos de 8 oz', quantity: 500, deadlineDays: 5, budgetCents: 12_000_000 },
  supplierName: 'Envases Sur',
  offer: { supplierId: 'envases-sur', unitPriceCents: 22_500, deliveryDays: 5, round: 2 },
  totalCents: 11_250_000,
  approval: 'human' as const,
  explanation: 'Cumple fecha y presupuesto — “la mejor” oferta… ✓ con caracteres fuera de WinAnsi.',
};

describe('buildPurchaseOrder', () => {
  it.each(['es', 'en'] as const)('genera un PDF carta de una página (%s)', async (lang) => {
    const bytes = await buildPurchaseOrder({ ...input, lang });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  });
});
