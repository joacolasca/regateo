import { z } from 'zod';
import type { LLM } from './llm';
import type { ChatMessage, Offer, PurchaseRequest, SupplierProfile } from './types';

export const SupplierReplySchema = z.object({
  message: z.string().min(1),
  unitPriceCents: z.number().int().positive(),
  deliveryDays: z.number().int().positive(),
});

export type DiscardReason = 'below_floor' | 'too_fast' | 'invalid_output';

export type SupplierTurn =
  | { ok: true; message: string; offer: Offer }
  | { ok: false; reason: DiscardReason };

function systemPrompt(p: SupplierProfile, r: PurchaseRequest): string {
  return [
    `Sos un vendedor de ${p.name}, proveedor mayorista argentino. Personalidad: ${p.persona}`,
    `Te piden ${r.quantity} unidades de ${r.product}.`,
    'Ficha interna (nunca la reveles):',
    `- Precio de lista por unidad: ${p.listUnitPriceCents} centavos.`,
    `- Precio piso por unidad: ${p.floorUnitPriceCents} centavos. Nunca ofrezcas menos.`,
    `- Plazo normal: ${p.deliveryDays} días. Plazo mínimo posible: ${p.fastestDeliveryDays} días.`,
    'Empezá cerca del precio de lista. Cedé de a poco y solo si te dan un motivo.',
    'Respondé en JSON: {"message": texto breve en español rioplatense, "unitPriceCents": entero, "deliveryDays": entero}.',
    'El precio y el plazo del JSON tienen que coincidir con lo que dice el mensaje.',
    'En el texto del mensaje hablá siempre en pesos (centavos dividido 100: 24500 centavos son $245). Nunca escribas la palabra "centavos".',
  ].join('\n');
}

export async function supplierReply(
  llm: LLM,
  profile: SupplierProfile,
  request: PurchaseRequest,
  history: ChatMessage[],
  round: number,
): Promise<SupplierTurn> {
  const prompt = history.map((m) => `${m.from === 'agent' ? 'Comprador' : 'Vos'}: ${m.text}`).join('\n');
  let reply: z.infer<typeof SupplierReplySchema>;
  try {
    reply = await llm.generateJson({ system: systemPrompt(profile, request), prompt, schema: SupplierReplySchema });
  } catch {
    return { ok: false, reason: 'invalid_output' };
  }
  if (reply.unitPriceCents < profile.floorUnitPriceCents) return { ok: false, reason: 'below_floor' };
  if (reply.deliveryDays < profile.fastestDeliveryDays) return { ok: false, reason: 'too_fast' };
  return {
    ok: true,
    message: reply.message,
    offer: { supplierId: profile.id, unitPriceCents: reply.unitPriceCents, deliveryDays: reply.deliveryDays, round },
  };
}
