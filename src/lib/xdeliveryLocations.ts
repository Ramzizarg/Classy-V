/**
 * Governorates & delegations for X-Delivery.
 * Names are the official spellings from GET /api/governorates and /api/delegations.
 */
export const XDELIVERY_DELEGATIONS: Record<string, readonly string[]> = {
  "Ariana": ["Ariana Ville", "Ennasr", "Ettadhamen", "Kalaat Landlous", "La Soukra", "Mnihla", "Raoued", "Sidi Thabet"],
  "Beja": ["Amdoun", "Beja Nord", "Beja Sud", "Goubellat", "Mejez El Bab", "Nefza", "Teboursouk", "Testour", "Thibar"],
  "Ben Arous": ["Ben Arous", "Bou Mhel El Bassatine", "El Mourouj", "Ezzahra", "Fouchana", "Hammam Chatt", "Hammam Lif", "Megrine", "Mohamadia", "Mornag", "Nouvelle Medina", "Rades"],
  "Bizerte": ["Bizerte Nord", "Bizerte Sud", "El Alia", "Ghar El Melh", "Ghezala", "Jarzouna", "Joumine", "Mateur", "Menzel Bourguiba", "Menzel Jemil", "Ras Jebel", "Sejnane", "Tinja", "Utique"],
  "Gabes": ["El Hamma", "El Metouia", "Gabes Medina", "Gabes Ouest", "Gabes Sud", "Ghannouche", "Mareth", "Matmata", "Menzel Habib", "Nouvelle Matmat"],
  "Gafsa": ["Belkhir", "El Guettar", "El Ksar", "El Mdhilla", "Gafsa Nord", "Gafsa Sud", "Metlaoui", "Moulares", "Redeyef", "Sidi Aich", "Sned"],
  "Jendouba": ["Ain Draham", "Balta Bou Aouene", "Bou Salem", "Fernana", "Ghardimaou", "Jendouba", "Jendouba Nord", "Oued Mliz", "Tabarka"],
  "Kairouan": ["Bou Hajla", "Chebika", "Cherarda", "El Ala", "Haffouz", "Hajeb El Ayoun", "Kairouan Nord", "Kairouan Sud", "Nasrallah", "Oueslatia", "Sbikha"],
  "Kasserine": ["El Ayoun", "Feriana", "Foussana", "Haidra", "Hassi El Frid", "Jediliane", "Kasserine Nord", "Kasserine Sud", "Mejel Bel Abbes", "Sbeitla", "Sbiba", "Thala"],
  "Kebili": ["Douz", "El Faouar", "Kebili Nord", "Kebili Sud", "Souk El Ahad"],
  "Kef": ["Dahmani", "El Ksour", "Jerissa", "Kalaa El Khasba", "Kalaat Sinane", "Le Kef Est", "Le Kef Ouest", "Le Sers", "Nebeur", "Sakiet Sidi Youssef", "Tajerouine", "Touiref"],
  "Mahdia": ["Bou Merdes", "Chorbane", "El Jem", "Hbira", "Ksour Essaf", "La Chebba", "Mahdia", "Melloulech", "Ouled Chamakh", "Sidi Alouene", "Souassi"],
  "Mannouba": ["Borj El Amri", "Douar Hicher", "El Battan", "Jedaida", "Mannouba", "Mornaguia", "Oued Ellil", "Tebourba"],
  "Medenine": ["Ajim", "Ben Guerdane", "Beni Khedache", "Houmet Essouk", "Medenine Nord", "Medenine Sud", "Midoun", "Sidi Makhlouf", "Zarzis"],
  "Monastir": ["Bekalta", "Bembla", "Beni Hassen", "Jemmal", "Ksar Helal", "Ksibet El Medioun", "Moknine", "Monastir", "Ouerdanine", "Sahline", "Sayada Lamta Bou Hjar", "Teboulba", "Zeramdine"],
  "Nabeul": ["Beni Khalled", "Beni Khiar", "Bou Argoub", "Dar Chaabane Elfehri", "El Haouaria", "El Mida", "Grombalia", "Hammam El Ghez", "Hammamet", "Kelibia", "Korba", "Menzel Bouzelfa", "Menzel Temime", "Nabeul", "Soliman", "Takelsa"],
  "Sfax": ["Agareb", "Bir Ali Ben Khelifa", "El Amra", "El Hencha", "Esskhira", "Ghraiba", "Jebeniana", "Kerkenah", "Mahras", "Menzel Chaker", "Sakiet Eddaier", "Sakiet Ezzit", "Sfax Est", "Sfax Sud", "Sfax Ville"],
  "Sidi Bouzid": ["Ben Oun", "Bir El Haffey", "Cebbala", "Jilma", "Maknassy", "Menzel Bouzaiene", "Mezzouna", "Ouled Haffouz", "Regueb", "Sidi Bouzid Est", "Sidi Bouzid Ouest", "Souk Jedid"],
  "Siliana": ["Bargou", "Bou Arada", "El Aroussa", "Gaafour", "Kesra", "Le Krib", "Makthar", "Rohia", "Sidi Bou Rouis", "Siliana Nord", "Siliana Sud"],
  "Sousse": ["Akouda", "Bou Ficha", "Enfidha", "Hammam Sousse", "Hergla", "Kalaa El Kebira", "Kalaa Essghira", "Kondar", "Msaken", "Sidi Bou Ali", "Sidi El Heni", "Sousse Jaouhara", "Sousse Riadh", "Sousse Ville"],
  "Tataouine": ["Bir Lahmar", "Dhehiba", "Ghomrassen", "Remada", "Smar", "Tataouine Nord", "Tataouine Sud"],
  "Tozeur": ["Degueche", "Hezoua", "Nefta", "Tameghza", "Tozeur"],
  "Tunis": ["Aouina", "Bab Bhar", "Bab Souika", "Carthage", "Cite El Khadra", "El Hrairia", "El Kabbaria", "El Kram", "El Menzah", "El Omrane", "El Omrane Superieur", "El Ouerdia", "Essijoumi", "Ettahrir", "Ezzouhour", "Jebel Jelloud", "La Goulette", "La Marsa", "La Medina", "Lac", "Le Bardo", "Sidi El Bechir", "Sidi Hassine", "Tunis Centre", "Tunis Ville"],
  "Zaghouan": ["Bir Mcherga", "El Fahs", "Ennadhour", "Hammam Zriba", "Saouef", "Zaghouan"],
};

export const XDELIVERY_GOVERNORATES = Object.keys(XDELIVERY_DELEGATIONS) as (keyof typeof XDELIVERY_DELEGATIONS)[];

export const XDELIVERY_STATUS_LABELS: Record<string, string> = {
  CREATED: "En attente",
  PENDING: "À enlever",
  COLLECTED: "Enlevés",
  ARRIVED_AT_DEPOT: "Au dépôt",
  RETURNED_AT_DEPOT: "Retour dépôt",
  OUT_FOR_DELIVERY: "En cours",
  DELIVERED: "Livrés",
  DELIVERED_PAID: "Livrés payés",
  RETURNED_TO_DEPOT_CLIENT: "Retour Client Agence",
  RETURNED_TO_DEPOT_SENDER: "Retour Expéditeur Agence",
  PENDING_RETURNS: "Retour envoyée",
  RETURNED_TO_SENDER: "Retour reçu par l'expéditeur",
};

/** English labels for the storefront track page. */
export const XDELIVERY_CUSTOMER_LABELS: Record<string, string> = {
  CREATED: "Waiting for pickup",
  PENDING: "Awaiting pickup",
  COLLECTED: "Collected",
  ARRIVED_AT_DEPOT: "At the depot",
  RETURNED_AT_DEPOT: "Returned to depot",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  DELIVERED_PAID: "Delivered",
  RETURNED_TO_DEPOT_CLIENT: "Returning to the agency",
  RETURNED_TO_DEPOT_SENDER: "Returning to us",
  PENDING_RETURNS: "Return in progress",
  RETURNED_TO_SENDER: "Returned to us",
};

export const XDELIVERY_STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "not_sent", label: "Non envoyée" },
  { value: "CREATED", label: "En attente" },
  { value: "PENDING", label: "À enlever" },
  { value: "COLLECTED", label: "Enlevés" },
  { value: "ARRIVED_AT_DEPOT", label: "Au dépôt" },
  { value: "OUT_FOR_DELIVERY", label: "En cours" },
  { value: "DELIVERED", label: "Livrés" },
  { value: "RETURNED", label: "Retours" },
] as const;

const RETURN_STATUSES = new Set([
  "RETURNED_AT_DEPOT",
  "RETURNED_TO_DEPOT_CLIENT",
  "RETURNED_TO_DEPOT_SENDER",
  "PENDING_RETURNS",
  "RETURNED_TO_SENDER",
]);

export function isXDeliveryReturnStatus(status: string | null | undefined) {
  return RETURN_STATUSES.has((status || "").toUpperCase());
}

export function xdeliveryCustomerLabel(status: string | null | undefined) {
  if (!status) return "";
  const code = status.toUpperCase();
  return XDELIVERY_CUSTOMER_LABELS[code] ?? XDELIVERY_STATUS_LABELS[code] ?? status;
}

export function xdeliveryFilterKey(barcode: string | null | undefined, status: string | null | undefined) {
  if (!barcode) return "not_sent";
  const code = (status || "CREATED").toUpperCase();
  if (code === "DELIVERED_PAID") return "DELIVERED";
  if (RETURN_STATUSES.has(code)) return "RETURNED";
  return code;
}

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const GOVERNORATE_ALIASES: Record<string, string> = {
  "le kef": "Kef",
  manouba: "Mannouba",
};

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = new Array<number>(cols).fill(0).map((_, i) => i);
  for (let i = 1; i < rows; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j < cols; j += 1) {
      const cur = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = cur;
    }
  }
  return dp[b.length];
}

export function matchGovernorate(raw: string | null | undefined): string | null {
  const needle = fold(raw ?? "");
  if (!needle) return null;
  if (GOVERNORATE_ALIASES[needle]) return GOVERNORATE_ALIASES[needle];
  return XDELIVERY_GOVERNORATES.find((name) => fold(name) === needle) ?? null;
}

export function matchDelegation(governorate: string, raw: string | null | undefined): string | null {
  const key = matchGovernorate(governorate) ?? governorate;
  const list = XDELIVERY_DELEGATIONS[key];
  if (!list) return null;
  const needle = fold(raw ?? "");
  if (!needle) return null;
  const exact = list.find((name) => fold(name) === needle);
  if (exact) return exact;
  if (needle.endsWith(" medina")) {
    const ville = list.find((name) => fold(name) === needle.replace(/ medina$/, " ville"));
    if (ville) return ville;
  }
  const contained = list
    .filter((name) => {
      const n = fold(name);
      return n.includes(needle) || needle.includes(n);
    })
    .sort((a, b) => fold(a).length - fold(b).length)[0];
  if (contained) return contained;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const name of list) {
    const dist = levenshtein(fold(name), needle);
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  const allowed = Math.max(2, Math.floor(needle.length * 0.3));
  return best && bestDist <= allowed ? best : null;
}

export function delegationsFor(governorate: string): readonly string[] {
  const key = matchGovernorate(governorate);
  return key ? XDELIVERY_DELEGATIONS[key] : [];
}
