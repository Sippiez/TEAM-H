import { tokenize } from "@/lib/text";

const SYNONYM_GROUPS = [
  ["dob", "birthdate", "birth date", "date of birth", "date de naissance", "birthday"],
  ["postal", "postal code", "code postal", "post code", "postcode", "pc", "zip", "zip code", "zipcode"],
  ["passport", "passeport"],
  ["surname", "last name", "family name", "nom de famille"],
  ["given name", "first name", "prenom"],
  ["middle name", "second name", "deuxieme prenom"],
  ["address", "adresse"],
  ["mailing address", "postal address", "adresse postale", "adresse de correspondance"],
  ["phone", "telephone", "tel"],
  ["email", "e-mail", "courriel"],
  ["guarantor", "garant", "garante"],
  ["reference", "personne de reference"],
  ["gender", "sex", "genre", "sexe"],
  ["birthplace", "place of birth", "lieu de naissance"],
  ["issue date", "date of issue", "date emission"],
  ["expiry date", "expiration date", "date of expiry", "date d'expiration", "date expiration"],
  ["travel date", "date of travel", "date de voyage"],
  ["citizenship", "proof of citizenship", "citizenship proof", "preuve de citoyennete"],
] as const;

function tokenOptions(text: string, isQuery: boolean): Set<string>[] {
  const tokens = tokenize(text);
  const options = tokens.map((token) => new Set([token]));

  for (const [groupIndex, group] of SYNONYM_GROUPS.entries()) {
    const canonical = `fieldalias${groupIndex}`;
    const groupTerms = new Set([canonical]);
    for (const phrase of group) {
      const phraseTokens = tokenize(phrase);
      for (const token of phraseTokens) groupTerms.add(token);
    }
    for (const phrase of group) {
      const phraseTokens = tokenize(phrase);
      for (let start = 0; start <= tokens.length - phraseTokens.length; start++) {
        if (!phraseTokens.every((token, offset) => tokens[start + offset] === token)) continue;
        options[start] = isQuery ? new Set([canonical]) : new Set(groupTerms);
        for (let index = start + 1; index < start + phraseTokens.length; index++) {
          options[index] = new Set();
        }
      }
    }
  }

  return options;
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function termsMatch(query: string, candidate: string): boolean {
  if (query === candidate) return true;
  if (query.startsWith("fieldalias") || candidate.startsWith("fieldalias")) return false;
  if (Math.min(query.length, candidate.length) >= 2 &&
      (query.startsWith(candidate) || candidate.startsWith(query))) {
    return true;
  }
  if (Math.abs(query.length - candidate.length) > 2) return false;
  const limit = Math.min(query.length, candidate.length) >= 8 ? 2 : 1;
  return editDistance(query, candidate) <= limit;
}

export function fieldSearchScore(query: string, candidateTexts: string[]): number {
  const queryOptions = tokenOptions(query, true);
  const candidateTerms = candidateTexts.flatMap((text) =>
    tokenOptions(text, false).flatMap((options) => [...options]),
  );
  return queryOptions.reduce(
    (score, options) =>
      score + (candidateTerms.some((candidate) => [...options].some((term) => termsMatch(term, candidate))) ? 1 : 0),
    0,
  );
}