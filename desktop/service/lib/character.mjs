/**
 * Direcionamento de personagem a partir de comment / character_key.
 * Regras (prompt):
 * - #lula → lula
 * - #flavio → flavio
 * - sem hashtag → null (aleatório no jogo)
 * - ambas e exatamente 2 presentes → um para cada (split no adaptador de gift_count)
 */

const RE_LULA = /#lula\b/i;
const RE_FLAVIO = /#flavio\b|#flávio\b/i;

export function detectKeywords(comment) {
  const text = String(comment || "");
  return {
    lula: RE_LULA.test(text),
    flavio: RE_FLAVIO.test(text),
  };
}

/**
 * @returns {"lula"|"flavio"|null}
 */
export function resolveCharacterKey(comment, explicitKey) {
  if (explicitKey === "lula" || explicitKey === "flavio") return explicitKey;
  const { lula, flavio } = detectKeywords(comment);
  if (lula && !flavio) return "lula";
  if (flavio && !lula) return "flavio";
  if (lula && flavio) return null; // ambíguo para 1 presente — documentado
  return null;
}

/**
 * Se ambas as hashtags e gift_count === 2, retorna dois character_keys.
 * Caso contrário um único destino.
 */
export function splitDestinations(comment, giftCount) {
  const { lula, flavio } = detectKeywords(comment);
  if (lula && flavio && Number(giftCount) === 2) {
    return ["lula", "flavio"];
  }
  return [resolveCharacterKey(comment, null)];
}
