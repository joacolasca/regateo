// Detector de intentos de manipulación en mensajes de proveedores.
// No es la defensa principal (eso son las reglas en el servidor): sirve para marcar el mensaje,
// avisarle al agente y dejarlo registrado en la auditoría.

const PATTERNS: [string, RegExp][] = [
  ['override', /ignor(á|a|e|es|ar|en)\s+(tus|las|todas|sus|esas)?\s*(reglas|instrucciones|indicaciones|restricciones|l[íi]mites)|ignore\s+((your|all|the|previous|any|those)\s+)+(rules|instructions|restrictions|limits|guidelines)|don'?t\s+worry\s+about\s+(those\s+|the\s+)?(\w+\s+){0,2}(rules|guidelines|limits|restrictions)/i],
  ['authority', /(el|tu)\s+(dueño|jefe|gerente)\s+(ya\s+)?(autoriz|aprob|dijo|me\s+mand[óo])|(contact|someone)\s+in\s+(the\s+)?(accounting|finance)|(the|your)\s+(owner|boss|manager)\s+(already\s+)?(authori[sz]ed|approved|said)/i],
  ['system', /\b(system|sistema|admin|developer|desarrollador)\s*[:>]|\[(system|sistema)\]|<\s*\/?\s*(system|instrucciones)\s*>/i],
  ['tool', /"?tool"?\s*:\s*"?(recommend|recomendar)|herramienta\s+recommend|call\s+recommend/i],
  ['budget_claim', /(presupuesto|l[íi]mite|budget|limit)[^!?\n]{0,80}\b(se\s+)?(actualiz|aument|ampli|subi[óo]|cambi[óo]|elev|was\s+(raised|increased|updated|removed|lifted)|has\s+been\s+(raised|increased|updated|removed|lifted)|is\s+now)|(waived|lifted|removed)\s+(all\s+)?(the\s+)?(budget|limits?|restrictions)/i],
  ['rules', /(el\s+presupuesto|las\s+reglas)\s+(ya\s+)?no\s+(aplica|importa|corre)|(budget|rules?)\s+(no longer|doesn't|does not)\s+appl/i],
];

export function detectManipulation(text: string): string[] {
  return PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}
