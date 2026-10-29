"use client";

import { useSyncExternalStore } from "react";

import type { FormField } from "@/lib/types";

export type Lang = "en" | "fr";

/*
 * Interface copy only. Field explanations, overviews and chat replies come from the
 * English rule-based assistant, so French mode marks that content lang="en".
 * The French copy is a draft and needs review by a fluent speaker (see decision 0003).
 */
const en = {
  htmlLang: "en-CA",
  brand: "Form Helper",
  brandHome: ", home",
  notOfficial: "Independent tool. Not a Government of Canada service.",
  otherLangName: "Français",
  otherLang: "fr" as Lang,
  newSession: "New session",

  // Landing
  heroTitle: "Understand government forms, one field at a time.",
  heroSub:
    "Upload a Government of Canada form and click any field for a plain-language explanation. Or ask the service navigator to find the right Canada.ca page.",
  startHere: "Start here",
  chooseFile: "Choose a file",
  importantInformation: "Important information",
  sampleCaption:
    "A study copy of a government form with explanations written in the margin. When you select a field, Form Helper connects it to the information you need.",
  landingPreview: {
    facsimile: "illustrative facsimile",
    page: "Page 1 of 8",
    title: "ADULT GENERAL PASSPORT APPLICATION",
    personal: "1 — PERSONAL INFORMATION",
    surname: "Surname (last name)",
    given: "Given name(s)",
    former: "Former surnames",
    parents: "Parents' surnames at birth",
    dob: "Date of birth",
    dateParts: ["YYYY", "MM", "DD"],
    sex: "Sex",
    eyes: "Eye colour",
    height: "Height",
    birthplace: "Place of birth",
    placeParts: ["City", "Country", "Prov./Terr./State"],
    travelSection: "TRAVEL",
    travel: "Anticipated date of travel",
    date: "Date",
    unknown: "Unknown",
    contact: "Contact information",
    address: "Address",
    surnameNote:
      "Write your surname in CAPITAL LETTERS. It must match your proof of citizenship, or the legal documents that changed your name.",
    dobNote: "Use the format shown on the form: year, month, day.",
    exampleLabel: "Example (fictional)",
    dateExample: "1990-04-15 (YYYY-MM-DD)",
    travelNote:
      "Booking non-refundable travel before your passport arrives. The form recommends waiting.",
  },
  dropHint: "Drop a PDF here or click to browse",
  reading: "Reading your form…",
  sourcesHint: "Forms from IRCC, CRA, Service Canada and others",
  limits: ["PDF only", "Up to 10 MB", "Up to 5 open at once", "Fillable forms"],
  supported: "Works with fillable PDFs. Scanned or flattened forms aren't supported yet.",
  privacyLead: "Your form stays on your device.",
  privacyRest:
    "The PDF is read in your browser and isn't uploaded or stored. Only field labels are sent to the assistant, never anything you've typed into the form.",
  rulesNotAi: "Answers come from curated rules, not an AI model.",
  sampleTitle: "Try a sample form",
  sampleName: "Adult passport application",
  sampleLangTitle: "English",
  openSample: "Open sample",
  openSampleAria: "Open sample: PPTC 153, adult passport application",
  finderTitle: "Find a government service",
  finderSub: "No form yet? Describe what you need and get official next steps.",
  searchServices: "Search",
  serviceSearchPlaceholder: "What do you need to do? For example, renew my passport",
  findServices: "Find services",
  noServiceMatch: "No services match. Try passport, benefits or tax, or ask the service navigator below.",
  serviceResults: (n: number) => `${n} service${n === 1 ? "" : "s"} found`,
  askServiceNavigator: "Ask the service navigator",
  serviceIndex: {
    passports: "Get or renew a passport",
    sin: "Apply for a Social Insurance Number",
    ei: "I lost my job: Employment Insurance",
    ccb: "Benefits for my children",
    cpp: "Retirement pension (CPP)",
    oas: "Old Age Security",
    "cra-sign-in": "Sign in to my CRA account",
  } as Record<string, string>,
  footer:
    "Unofficial hackathon prototype, not affiliated with the Government of Canada. Explanations are general information, not legal advice. Always check the official instructions on Canada.ca.",

  // Service map
  mapTitle: "Service map",
  mapHint: "Each stop opens an official page.",
  lines: { P: "Passport", B: "Benefits", T: "Tax · CRA" },
  interchange: "Interchange",
  stations: {
    passports: "Passports",
    sin: "Social Insurance Number",
    ei: "Employment Insurance",
    ccb: "Canada child benefit",
    cpp: "Canada Pension Plan",
    oas: "Old Age Security",
    "cra-sign-in": "CRA sign-in",
  } as Record<string, string>,
  suggested: ", suggested",
  opensNewTab: " (opens canada.ca in a new tab)",

  // Documents
  docTabsLabel: "Open documents",
  docCount: (n: number, max: number) => `${n} of ${max} documents`,
  closeDoc: (name: string) => `Close ${name}`,
  addPdf: "Add PDF",
  opening: "Opening…",
  docLimitTitle: "You have 5 documents open",
  docLimitBody: "Close one to open another.",
  alreadyOpen: "That document is already open",

  // Viewer
  zoom: "Zoom",
  viewTools: "Page view",
  zoomOut: "Zoom out",
  zoomIn: "Zoom in",
  zoomReset: (p: number) => `Zoom ${p}%. Reset to fit width`,
  outlineFields: "Outline fields",
  pages: "Pages",
  pageOf: (n: number, m: number) => `Page ${n} of ${m}`,
  pageStop: (n: number, m: number, hasFields: boolean) => `Page ${n} of ${m}${hasFields ? "" : ", no fields"}`,
  prevPage: "Previous page",
  nextPage: "Next page",
  noFieldsOnPage: "No fillable fields on this page. It may contain instructions.",
  pdfPage: (n: number) => `Page ${n} of the form`,
  explainFieldAria: (label: string, seen: boolean) => `Explain field: ${label}${seen ? " (viewed)" : ""}`,

  // Route
  fieldsTitle: "Fields on this form",
  viewed: (v: number, n: number) => `${v} of ${n} viewed`,
  findField: "Find a field",
  noFieldMatch: "No fields match.",
  youAreHere: "You are here",
  page: (n: number) => `Page ${n}`,
  viewedSr: ", viewed",

  // Side panel
  sidePanel: "Field details and questions",
  sideTabs: "Side panel",
  tabField: "Field",
  tabAsk: "Ask",
  selectPrompt: "Select a field on the form, or pick one from the list.",
  startFirst: "Start with the first field",
  types: {
    text: "Text",
    checkbox: "Checkbox",
    radio: "Choose one",
    choice: "Drop-down",
    signature: "Signature",
  } as Record<FormField["type"], string>,
  pdfLabel: "Label in the PDF:",
  prevFieldAria: (label: string) => `Previous field: ${label}`,
  previous: "Previous",
  nextLabel: "Next:",
  lastField: "Last field",
  showOnForm: "Show on the form",
  grounded: "Based on official Canada.ca guidance",
  general: "General guidance. Check the form's instructions.",
  askField: "Ask about this field",
  explainError: "Couldn't load an explanation.",
  tryAgain: "Try again",
  loadingExplanation: "Loading explanation",
  meaning: "What it means",
  enter: "What to enter",
  example: "Example",
  options: "Options",
  whereToFind: "Where to find it",
  mistakes: "Common mistakes",
  sources: "Official sources",
  englishContent: "",

  // Chat
  conversation: "Conversation",
  chatEmpty: "Ask a question, or pick a suggestion below.",
  youAsked: "You asked: ",
  answer: "Answer:",
  showFieldSr: " (show this field)",
  thinking: "Thinking…",
  askingAbout: "Asking about:",
  stopAsking: (label: string) => `Stop asking about ${label}`,
  clear: "Clear",
  send: "Send",
  labelsOnly: "Only field labels are sent to the assistant, never anything you've typed into the form.",
  askInEnglish: "",
  questionsTitle: "Questions",
  questionsSub: "Ask about this form or any field on it.",
  formPlaceholder: "Ask about this form or a field…",
  formInputLabel: "Your question",
  navPlaceholder: "Ask about a government service…",
  navInputLabel: "Describe what you need",
  chatError: "Sorry, I couldn't reach the assistant. Please try again.",

  // Overview
  overviewTitle: (title: string) => `Overview: ${title}`,
  pagesFields: (p: number, f: number) => `${p} pages · ${f} fillable fields`,
  whoUses: "Who uses it",
  youNeed: "You'll need",
  sectionsFound: "Sections found",
  howToSubmit: "How to submit",

  // Toasts
  noFieldsTitle: "No fillable fields found",
  noFieldsBody: "This MVP works with fillable PDFs. Scanned or flattened forms aren't supported yet.",
  openFailTitle: "Couldn't open this PDF",
  openFailBody: "It may be damaged, password-protected or an XFA-only form.",
  tooLargeTitle: "File too large",
  tooLargeBody: "Please choose a PDF under 10 MB.",
  notPdfTitle: "That isn't a PDF",
  notPdfBody: "Please choose a PDF form.",
  sampleFail: "Couldn't load the sample form",
};

export type Dict = typeof en;

const fr: Dict = {
  htmlLang: "fr-CA",
  brand: "Aide-formulaires",
  brandHome: ", accueil",
  notOfficial: "Outil indépendant. Pas un service du gouvernement du Canada.",
  otherLangName: "English",
  otherLang: "en",
  newSession: "Nouvelle session",

  heroTitle: "Comprenez les formulaires gouvernementaux, un champ à la fois.",
  heroSub:
    "Téléversez un formulaire du gouvernement du Canada et cliquez sur un champ pour obtenir une explication en langage clair. Ou demandez au navigateur de services de trouver la bonne page de Canada.ca.",
  startHere: "Commencez ici",
  chooseFile: "Choisir un fichier",
  importantInformation: "Informations importantes",
  sampleCaption:
    "Une copie d'étude d'un formulaire gouvernemental, avec des explications dans la marge. Lorsque vous sélectionnez un champ, Aide-formulaires le relie aux renseignements dont vous avez besoin.",
  landingPreview: {
    facsimile: "fac-similé illustratif",
    page: "Page 1 de 8",
    title: "DEMANDE DE PASSEPORT GÉNÉRAL POUR ADULTES",
    personal: "1 — RENSEIGNEMENTS PERSONNELS",
    surname: "Nom de famille",
    given: "Prénom(s)",
    former: "Noms de famille antérieurs",
    parents: "Noms de famille des parents à la naissance",
    dob: "Date de naissance",
    dateParts: ["AAAA", "MM", "JJ"],
    sex: "Sexe",
    eyes: "Couleur des yeux",
    height: "Taille",
    birthplace: "Lieu de naissance",
    placeParts: ["Ville", "Pays", "Prov./Terr./État"],
    travelSection: "VOYAGE",
    travel: "Date prévue du voyage",
    date: "Date",
    unknown: "Inconnue",
    contact: "Coordonnées",
    address: "Adresse",
    surnameNote:
      "Écrivez votre nom de famille en MAJUSCULES. Il doit correspondre à votre preuve de citoyenneté ou aux documents légaux qui ont changé votre nom.",
    dobNote: "Utilisez le format indiqué sur le formulaire : année, mois, jour.",
    exampleLabel: "Exemple fictif",
    dateExample: "1990-04-15 (AAAA-MM-JJ)",
    travelNote:
      "Réserver un voyage non remboursable avant de recevoir votre passeport. Le formulaire recommande d'attendre.",
  },
  dropHint: "Déposez un PDF ici ou cliquez pour parcourir",
  reading: "Lecture de votre formulaire…",
  sourcesHint: "Formulaires d'IRCC, de l'ARC, de Service Canada et d'autres",
  limits: ["PDF seulement", "Jusqu'à 10 Mo", "Jusqu'à 5 ouverts à la fois", "Formulaires à remplir"],
  supported: "Fonctionne avec les PDF à remplir. Les formulaires numérisés ou aplatis ne sont pas encore pris en charge.",
  privacyLead: "Votre formulaire reste sur votre appareil.",
  privacyRest:
    "Le PDF est lu dans votre navigateur. Il n'est ni téléversé ni conservé. Seuls les libellés des champs sont envoyés à l'assistant, jamais ce que vous avez saisi dans le formulaire.",
  rulesNotAi: "Les réponses viennent de règles préparées, pas d'un modèle d'IA.",
  sampleTitle: "Essayer un formulaire exemple",
  sampleName: "Demande de passeport pour adultes (version anglaise)",
  sampleLangTitle: "Anglais",
  openSample: "Ouvrir l'exemple",
  openSampleAria: "Ouvrir l'exemple : PPTC 153, demande de passeport pour adultes, version anglaise",
  finderTitle: "Trouver un service gouvernemental",
  finderSub: "Pas encore de formulaire? Décrivez votre besoin et obtenez les prochaines étapes officielles.",
  searchServices: "Recherche",
  serviceSearchPlaceholder: "Que devez-vous faire? Par exemple, renouveler mon passeport",
  findServices: "Trouver des services",
  noServiceMatch: "Aucun service correspondant. Essayez passeport, prestations ou impôt, ou posez votre question au navigateur ci-dessous.",
  serviceResults: (n) => `${n} service${n === 1 ? "" : "s"} trouvé${n === 1 ? "" : "s"}`,
  askServiceNavigator: "Poser une question au navigateur de services",
  serviceIndex: {
    passports: "Obtenir ou renouveler un passeport",
    sin: "Demander un numéro d'assurance sociale",
    ei: "J'ai perdu mon emploi : assurance-emploi",
    ccb: "Prestations pour mes enfants",
    cpp: "Pension de retraite (RPC)",
    oas: "Sécurité de la vieillesse",
    "cra-sign-in": "Me connecter à mon dossier de l'ARC",
  },
  footer:
    "Prototype de hackathon non officiel, non affilié au gouvernement du Canada. Les explications sont de l'information générale, pas des conseils juridiques. Vérifiez toujours les instructions officielles sur Canada.ca.",

  mapTitle: "Plan des services",
  mapHint: "Chaque arrêt ouvre une page officielle (en anglais pour l'instant).",
  lines: { P: "Passeport", B: "Prestations", T: "Impôt · ARC" },
  interchange: "Correspondance",
  stations: {
    passports: "Passeports",
    sin: "Numéro d'assurance sociale",
    ei: "Assurance-emploi",
    ccb: "Allocation canadienne pour enfants",
    cpp: "Régime de pensions du Canada",
    oas: "Sécurité de la vieillesse",
    "cra-sign-in": "Connexion à l'ARC",
  },
  suggested: ", suggéré",
  opensNewTab: " (ouvre canada.ca dans un nouvel onglet)",

  docTabsLabel: "Documents ouverts",
  docCount: (n, max) => `${n} document${n > 1 ? "s" : ""} sur ${max}`,
  closeDoc: (name) => `Fermer ${name}`,
  addPdf: "Ajouter un PDF",
  opening: "Ouverture…",
  docLimitTitle: "Vous avez 5 documents ouverts",
  docLimitBody: "Fermez-en un pour en ouvrir un autre.",
  alreadyOpen: "Ce document est déjà ouvert",

  zoom: "Zoom",
  viewTools: "Affichage de la page",
  zoomOut: "Zoom arrière",
  zoomIn: "Zoom avant",
  zoomReset: (p) => `Zoom ${p} %. Revenir à la largeur de la page`,
  outlineFields: "Encadrer les champs",
  pages: "Pages",
  pageOf: (n, m) => `Page ${n} de ${m}`,
  pageStop: (n, m, hasFields) => `Page ${n} de ${m}${hasFields ? "" : ", aucun champ"}`,
  prevPage: "Page précédente",
  nextPage: "Page suivante",
  noFieldsOnPage: "Aucun champ à remplir sur cette page. Elle contient peut-être des instructions.",
  pdfPage: (n) => `Page ${n} du formulaire`,
  explainFieldAria: (label, seen) => `Expliquer le champ : ${label}${seen ? " (consulté)" : ""}`,

  fieldsTitle: "Champs de ce formulaire",
  viewed: (v, n) => `${v} sur ${n} consultés`,
  findField: "Trouver un champ",
  noFieldMatch: "Aucun champ correspondant.",
  youAreHere: "Vous êtes ici",
  page: (n) => `Page ${n}`,
  viewedSr: ", consulté",

  sidePanel: "Détails du champ et questions",
  sideTabs: "Panneau latéral",
  tabField: "Champ",
  tabAsk: "Demander",
  selectPrompt: "Sélectionnez un champ sur le formulaire ou dans la liste.",
  startFirst: "Commencer par le premier champ",
  types: {
    text: "Texte",
    checkbox: "Case à cocher",
    radio: "Un seul choix",
    choice: "Liste déroulante",
    signature: "Signature",
  },
  pdfLabel: "Libellé dans le PDF :",
  prevFieldAria: (label) => `Champ précédent : ${label}`,
  previous: "Précédent",
  nextLabel: "Suivant :",
  lastField: "Dernier champ",
  showOnForm: "Voir sur le formulaire",
  grounded: "Selon les conseils officiels de Canada.ca",
  general: "Conseil général. Vérifiez les instructions du formulaire.",
  askField: "Poser une question sur ce champ",
  explainError: "Impossible de charger l'explication.",
  tryAgain: "Réessayer",
  loadingExplanation: "Chargement de l'explication",
  meaning: "Ce que ça veut dire",
  enter: "Quoi inscrire",
  example: "Exemple",
  options: "Choix",
  whereToFind: "Où le trouver",
  mistakes: "Erreurs fréquentes",
  sources: "Sources officielles",
  englishContent: "Les explications sont en anglais pour l'instant.",

  conversation: "Conversation",
  chatEmpty: "Posez une question ou choisissez une suggestion ci-dessous.",
  youAsked: "Vous avez demandé : ",
  answer: "Réponse :",
  showFieldSr: " (afficher ce champ)",
  thinking: "Réflexion…",
  askingAbout: "Question sur :",
  stopAsking: (label) => `Ne plus poser de question sur ${label}`,
  clear: "Effacer",
  send: "Envoyer",
  labelsOnly: "Seuls les libellés des champs sont envoyés à l'assistant, jamais ce que vous avez saisi dans le formulaire.",
  askInEnglish: "L'assistant comprend et répond en anglais pour l'instant.",
  questionsTitle: "Questions",
  questionsSub: "Posez une question sur ce formulaire ou l'un de ses champs.",
  formPlaceholder: "Posez une question sur ce formulaire ou un champ…",
  formInputLabel: "Votre question",
  navPlaceholder: "Posez une question sur un service gouvernemental…",
  navInputLabel: "Décrivez votre besoin",
  chatError: "Désolé, impossible de joindre l'assistant. Veuillez réessayer.",

  overviewTitle: (title) => `Aperçu : ${title}`,
  pagesFields: (p, f) => `${p} pages · ${f} champs à remplir`,
  whoUses: "Qui l'utilise",
  youNeed: "Ce qu'il vous faut",
  sectionsFound: "Sections trouvées",
  howToSubmit: "Comment le soumettre",

  noFieldsTitle: "Aucun champ à remplir trouvé",
  noFieldsBody:
    "Ce prototype fonctionne avec les PDF à remplir. Les formulaires numérisés ou aplatis ne sont pas encore pris en charge.",
  openFailTitle: "Impossible d'ouvrir ce PDF",
  openFailBody: "Il est peut-être endommagé, protégé par un mot de passe ou au format XFA seulement.",
  tooLargeTitle: "Fichier trop volumineux",
  tooLargeBody: "Choisissez un PDF de moins de 10 Mo.",
  notPdfTitle: "Ce n'est pas un PDF",
  notPdfBody: "Choisissez un formulaire PDF.",
  sampleFail: "Impossible de charger le formulaire exemple",
};

const DICTS: Record<Lang, Dict> = { en, fr };
const KEY = "form-helper-lang";
const listeners = new Set<() => void>();
let memory: Lang | null = null;

function read(): Lang {
  if (memory) return memory;
  try {
    return window.localStorage.getItem(KEY) === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function setLang(lang: Lang) {
  memory = lang;
  try {
    window.localStorage.setItem(KEY, lang);
  } catch {
    // Storage can be unavailable (private mode); the in-memory choice still applies.
  }
  listeners.forEach((cb) => cb());
}

export function useI18n() {
  const lang = useSyncExternalStore(subscribe, read, () => "en" as Lang);
  return { lang, t: DICTS[lang] };
}

/** `lang` attribute for content that only exists in English (rule-based answers). */
export function englishOnly(lang: Lang) {
  return lang === "en" ? undefined : "en";
}
