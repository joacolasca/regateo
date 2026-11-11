import { scenarios } from '@/core/scenarios';

/** Lista los escenarios disponibles. Los pisos de precio de los proveedores no se publican. */
export function GET() {
  return Response.json(
    scenarios.map((s) => ({
      id: s.id,
      title: s.title,
      request: s.request,
      defaultPolicy: s.policy,
      suppliers: s.suppliers.map(({ id, name }) => ({ id, name })),
    })),
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}
