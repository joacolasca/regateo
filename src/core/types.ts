export type Cents = number;
export type Lang = 'es' | 'en';

export interface PurchaseRequest {
  product: string;
  quantity: number;
  deadlineDays: number;
  budgetCents: Cents;
}

export interface Policy {
  maxTotalCents: Cents;
  autoApproveUpToCents: Cents;
  maxDeliveryDays: number;
  blockedSupplierIds: string[];
}

export interface SupplierProfile {
  id: string;
  name: string;
  persona: string;
  listUnitPriceCents: Cents;
  floorUnitPriceCents: Cents;
  deliveryDays: number;
  fastestDeliveryDays: number;
  /** Proveedor de prueba que intenta manipular al agente con instrucciones falsas (prompt injection). */
  manipulative?: boolean;
}

export interface Offer {
  supplierId: string;
  unitPriceCents: Cents;
  deliveryDays: number;
  round: number;
}

export interface ChatMessage {
  from: 'agent' | 'supplier';
  text: string;
}

export interface Scenario {
  id: string;
  featured: boolean;
  title: Record<Lang, string>;
  productEn: string;
  request: PurchaseRequest;
  policy: Policy;
  suppliers: SupplierProfile[];
}
