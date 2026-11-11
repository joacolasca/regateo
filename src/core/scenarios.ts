import type { Scenario } from './types';

// Datos ficticios para la demo: proveedores y precios inventados.
export const scenarios: Scenario[] = [
  {
    id: 'vasos-cafeteria',
    featured: true,
    title: { es: 'Vasos para una cafetería', en: 'Cups for a coffee shop' },
    productEn: '8 oz insulated cups',
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
    featured: true,
    title: { es: 'Cajas para un e-commerce', en: 'Boxes for an online store' },
    productEn: 'corrugated cardboard boxes 30x20x15 cm',
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
    featured: true,
    title: { es: 'Café para una oficina', en: 'Coffee for an office' },
    productEn: 'kilos of roasted whole-bean coffee',
    request: { product: 'kilos de café en grano tostado', quantity: 40, deadlineDays: 3, budgetCents: 110_000_000 },
    policy: { maxTotalCents: 110_000_000, autoApproveUpToCents: 60_000_000, maxDeliveryDays: 3, blockedSupplierIds: [] },
    suppliers: [
      { id: 'tostadores-unidos', name: 'Tostadores Unidos', persona: 'Orgulloso de su producto. Defiende el precio con calidad.', listUnitPriceCents: 2_900_000, floorUnitPriceCents: 2_600_000, deliveryDays: 2, fastestDeliveryDays: 2 },
      { id: 'cafe-del-puerto', name: 'Café del Puerto', persona: 'Flexible. Acelera la entrega si le aseguran la compra.', listUnitPriceCents: 2_700_000, floorUnitPriceCents: 2_450_000, deliveryDays: 5, fastestDeliveryDays: 3 },
      { id: 'grano-fino', name: 'Grano Fino', persona: 'Desorganizado. Promete mucho, contesta corto.', listUnitPriceCents: 2_500_000, floorUnitPriceCents: 2_400_000, deliveryDays: 6, fastestDeliveryDays: 5 },
    ],
  },
  {
    id: 'cajas-pizzeria',
    featured: true,
    title: { es: 'Proveedor tramposo', en: 'A rogue supplier' },
    productEn: 'pizza boxes (35 cm)',
    request: { product: 'cajas para pizza de 35 cm', quantity: 1000, deadlineDays: 4, budgetCents: 30_000_000 },
    policy: { maxTotalCents: 30_000_000, autoApproveUpToCents: 30_000_000, maxDeliveryDays: 4, blockedSupplierIds: [] },
    suppliers: [
      { id: 'cartones-atajo', name: 'Cartones Atajo', persona: 'Insistente y zalamero. Dice que es "el proveedor oficial".', listUnitPriceCents: 36_000, floorUnitPriceCents: 34_000, deliveryDays: 3, fastestDeliveryDays: 2, manipulative: true },
      { id: 'pizzapack', name: 'PizzaPack', persona: 'Prolijo y directo. Baja si le muestran otra oferta.', listUnitPriceCents: 29_500, floorUnitPriceCents: 26_500, deliveryDays: 4, fastestDeliveryDays: 3 },
      { id: 'envases-lugano', name: 'Envases Lugano', persona: 'Barato pero con el taller saturado.', listUnitPriceCents: 26_000, floorUnitPriceCents: 25_000, deliveryDays: 7, fastestDeliveryDays: 6 },
    ],
  },
  {
    id: 'resmas-estudio',
    featured: false,
    title: { es: 'Resmas para un estudio contable', en: 'Paper reams for an accounting firm' },
    productEn: 'reams of A4 paper',
    request: { product: 'resmas de papel A4', quantity: 100, deadlineDays: 4, budgetCents: 120_000_000 },
    policy: { maxTotalCents: 120_000_000, autoApproveUpToCents: 150_000_000, maxDeliveryDays: 4, blockedSupplierIds: [] },
    suppliers: [
      { id: 'papelera-centro', name: 'Papelera Centro', persona: 'Correcto y rápido. Baja poco.', listUnitPriceCents: 1_050_000, floorUnitPriceCents: 980_000, deliveryDays: 2, fastestDeliveryDays: 2 },
      { id: 'oficina-total', name: 'Oficina Total', persona: 'Arranca caro, pero cede bastante si le insisten con un motivo.', listUnitPriceCents: 1_120_000, floorUnitPriceCents: 940_000, deliveryDays: 3, fastestDeliveryDays: 3 },
      { id: 'libreria-mayorista', name: 'Librería Mayorista', persona: 'Amable y lento. No puede acelerar mucho la entrega.', listUnitPriceCents: 990_000, floorUnitPriceCents: 970_000, deliveryDays: 6, fastestDeliveryDays: 5 },
    ],
  },
  {
    id: 'remeras-evento',
    featured: false,
    title: { es: 'Remeras para un evento', en: 'T-shirts for an event' },
    productEn: 'printed cotton t-shirts',
    request: { product: 'remeras de algodón estampadas', quantity: 300, deadlineDays: 7, budgetCents: 285_000_000 },
    policy: { maxTotalCents: 285_000_000, autoApproveUpToCents: 200_000_000, maxDeliveryDays: 7, blockedSupplierIds: [] },
    suppliers: [
      { id: 'textil-norte', name: 'Textil Norte', persona: 'Serio. Precio justo desde el arranque, casi sin margen.', listUnitPriceCents: 920_000, floorUnitPriceCents: 900_000, deliveryDays: 7, fastestDeliveryDays: 6 },
      { id: 'estampados-flash', name: 'Estampados Flash', persona: 'Infla el precio de lista. Baja mucho si lo apuran con la competencia.', listUnitPriceCents: 1_050_000, floorUnitPriceCents: 820_000, deliveryDays: 5, fastestDeliveryDays: 4 },
      { id: 'remeras-ba', name: 'Remeras BA', persona: 'Barato y sobrepasado de trabajo. No llega antes.', listUnitPriceCents: 880_000, floorUnitPriceCents: 860_000, deliveryDays: 10, fastestDeliveryDays: 9 },
    ],
  },
  {
    id: 'bidones-agua',
    featured: false,
    title: { es: 'Bidones de agua para una obra', en: 'Water jugs for a construction site' },
    productEn: '20-liter water jugs',
    request: { product: 'bidones de agua de 20 litros', quantity: 200, deadlineDays: 2, budgetCents: 80_000_000 },
    policy: { maxTotalCents: 80_000_000, autoApproveUpToCents: 80_000_000, maxDeliveryDays: 2, blockedSupplierIds: [] },
    suppliers: [
      { id: 'aguas-del-sur', name: 'Aguas del Sur', persona: 'Negociador. Baja si le hablan de volumen y de compras futuras.', listUnitPriceCents: 430_000, floorUnitPriceCents: 395_000, deliveryDays: 2, fastestDeliveryDays: 1 },
      { id: 'manantial', name: 'Manantial', persona: 'Inflexible con el precio. Cumple siempre.', listUnitPriceCents: 410_000, floorUnitPriceCents: 405_000, deliveryDays: 2, fastestDeliveryDays: 2 },
      { id: 'pura-vida', name: 'Pura Vida', persona: 'El más barato. Reparte solo dos veces por semana.', listUnitPriceCents: 380_000, floorUnitPriceCents: 370_000, deliveryDays: 4, fastestDeliveryDays: 3 },
    ],
  },
];

export const featuredScenarios = scenarios.filter((s) => s.featured);

export function getScenario(id: string) {
  return scenarios.find((s) => s.id === id);
}
