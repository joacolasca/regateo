import type { Scenario } from './types';

// Datos ficticios para la demo: proveedores y precios inventados.
export const scenarios: Scenario[] = [
  {
    id: 'vasos-cafeteria',
    request: { product: 'vasos térmicos de 8 oz', quantity: 500, deadlineDays: 5, budgetCents: 12_000_000 },
    policy: { maxTotalCents: 12_000_000, autoApproveUpToCents: 8_000_000, maxDeliveryDays: 5, blockedSupplierIds: [] },
    suppliers: [
      { id: 'envases-sur', name: 'Envases Sur', persona: 'Directo y práctico. Cede si le ofrecen cerrar hoy.', listUnitPriceCents: 24_800, floorUnitPriceCents: 22_500, deliveryDays: 6, fastestDeliveryDays: 5 },
      { id: 'descartables-ya', name: 'Descartables Ya', persona: 'Simpático, el más barato, pero no puede acelerar la entrega.', listUnitPriceCents: 22_400, floorUnitPriceCents: 21_000, deliveryDays: 7, fastestDeliveryDays: 7 },
      { id: 'packnorte', name: 'PackNorte', persona: 'Formal y rígido. Casi no negocia el precio.', listUnitPriceCents: 25_600, floorUnitPriceCents: 24_800, deliveryDays: 4, fastestDeliveryDays: 3 },
    ],
  },
  {
    id: 'cajas-ecommerce',
    request: { product: 'cajas de cartón corrugado 30x20x15', quantity: 2000, deadlineDays: 10, budgetCents: 90_000_000 },
    policy: { maxTotalCents: 90_000_000, autoApproveUpToCents: 100_000_000, maxDeliveryDays: 10, blockedSupplierIds: ['cartonera-oeste'] },
    suppliers: [
      { id: 'cartonera-oeste', name: 'Cartonera Oeste', persona: 'Agresivo con el precio. Insiste en cerrar rápido.', listUnitPriceCents: 36_000, floorUnitPriceCents: 33_000, deliveryDays: 6, fastestDeliveryDays: 5 },
      { id: 'embalajes-rio', name: 'Embalajes Río', persona: 'Cordial. Da descuento por volumen si se lo piden.', listUnitPriceCents: 44_000, floorUnitPriceCents: 39_500, deliveryDays: 9, fastestDeliveryDays: 7 },
      { id: 'corrugados-delta', name: 'Corrugados Delta', persona: 'Seco. Baja el precio solo si le nombran a la competencia.', listUnitPriceCents: 46_500, floorUnitPriceCents: 41_000, deliveryDays: 8, fastestDeliveryDays: 8 },
    ],
  },
  {
    id: 'cafe-oficina',
    request: { product: 'kilos de café en grano tostado', quantity: 40, deadlineDays: 3, budgetCents: 110_000_000 },
    policy: { maxTotalCents: 110_000_000, autoApproveUpToCents: 60_000_000, maxDeliveryDays: 3, blockedSupplierIds: [] },
    suppliers: [
      { id: 'tostadores-unidos', name: 'Tostadores Unidos', persona: 'Orgulloso de su producto. Defiende el precio con calidad.', listUnitPriceCents: 2_900_000, floorUnitPriceCents: 2_600_000, deliveryDays: 2, fastestDeliveryDays: 2 },
      { id: 'cafe-del-puerto', name: 'Café del Puerto', persona: 'Flexible. Acelera la entrega si le aseguran la compra.', listUnitPriceCents: 2_700_000, floorUnitPriceCents: 2_450_000, deliveryDays: 5, fastestDeliveryDays: 3 },
      { id: 'grano-fino', name: 'Grano Fino', persona: 'Desorganizado. Promete mucho, contesta corto.', listUnitPriceCents: 2_500_000, floorUnitPriceCents: 2_400_000, deliveryDays: 6, fastestDeliveryDays: 5 },
    ],
  },
];

export function getScenario(id: string) {
  return scenarios.find((s) => s.id === id);
}
