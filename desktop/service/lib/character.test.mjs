import { detectKeywords, resolveCharacterKey, splitDestinations } from "./character.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(detectKeywords("bora #lula").lula === true, "lula keyword");
assert(detectKeywords("vai #Flávio").flavio === true, "flavio accent");
assert(resolveCharacterKey("x #lula", null) === "lula", "resolve lula");
assert(resolveCharacterKey("oi", null) === null, "no keyword null");
assert(JSON.stringify(splitDestinations("#lula #flavio", 2)) === JSON.stringify(["lula", "flavio"]), "split two");
assert(splitDestinations("#lula #flavio", 1).length === 1, "ambiguous single");

console.log("character.test.mjs OK");
