"use client";

import { useSyncExternalStore } from "react";

import type { FormField, OfficialLookupSummary } from "@/lib/types";

export type Lang = "en" | "fr";

/*
 * Curated field explanations remain in English. AI chat uses the interface
 * language at request time, recorded on each message.
 * The French copy is a draft and needs review by a fluent speaker (see decision 0003).
 */
const en = {
  htmlLang: "en-CA",
  brand: "formER",
  brandHome: ", home",
  otherLangName: "Français",
  otherLang: "fr" as Lang,
  newSession: "New session",

  // Landing
  heroTitle: "Understand government forms, one field at a time.",
  heroSub:
    "Upload a government form and click any field for a plain-language explanation. Or start a chat for current official instructions.",
  startHere: "Start here",
  startChat: "Start with just chat",
  chatOnlyHint: "No PDF needed. Add one anytime to open the form preview.",
  chatTitle: "How can we help?",
  chatSub: "Ask about a government service, or add a PDF for help with a form.",
  chooseFile: "Choose a file",
  sampleCaption:
    "A study copy of a government form with explanations written in the margin. When you select a field, formER connects it to the information you need.",
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
  supported: "Use blank, fillable PDFs. Scanned, flattened, password-protected and XFA-only forms aren't supported for field explanations.",
  privacyRest:
    "The PDF is read in your browser and isn't uploaded. Chat sends the filename, form and field metadata, and recent messages to the configured AI provider (OpenAI by default, or Google Gemini), not PDF bytes or entered field values. Official lookup checks known pages first and uses Serper to discover other official pages when needed. Serper receives catalog keywords or the public title and number read from a blank form, plus the information topic, interface language and jurisdiction when known — never chat history, filenames or field values. Use blank forms only.",
  rulesNotAi: "Chat uses the configured AI provider (OpenAI by default, or Google Gemini) for answers, without built-in web search. Official lookup checks known pages first and uses Serper for web search when needed. Serper receives catalog keywords or the public title and number read from a blank form, plus the information topic, interface language and jurisdiction when known, not chat history, filenames or field values. Use blank forms only. Search snippets are not evidence: the app must fetch and verify official pages before using their text in an answer.",
  aiPrivacyDetails: "AI and search privacy",
  featuresTitle: "What formER does",
  features: [
    { title: "Explains each field", body: "Select a field for plain-language help." },
    { title: "Points to official pages", body: "Guidance links to government sources." },
    { title: "Keeps your PDF local", body: "Your PDF is read in your browser, not uploaded." },
    { title: "English or French", body: "Switch languages anytime." },
  ],
  dataDetails: "How chat and search use data",
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
  noServiceMatch: "No services match. Try passport, benefits or tax.",
  serviceResults: (n: number) => `${n} service${n === 1 ? "" : "s"} found`,
  serviceIndex: {
    passports: "Get or renew a passport",
    sin: "Apply for a Social Insurance Number",
    ei: "I lost my job: Employment Insurance",
    ccb: "Benefits for my children",
    cpp: "Retirement pension (CPP)",
    oas: "Old Age Security",
    "cra-sign-in": "Sign in to my CRA account",
  } as Record<string, string>,
  serviceDepartments: {
    passports: "IRCC", sin: "ESDC", ei: "ESDC", ccb: "CRA",
    cpp: "ESDC", oas: "ESDC", "cra-sign-in": "CRA",
  } as Record<string, string>,
  footer:
    "Unofficial hackathon prototype, not affiliated with any government. Explanations are general information, not legal advice. Check the linked official instructions.",

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
  opensNewTab: " (opens an official government site in a new tab)",

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
  showFieldReference: (document: string, page: number, label: string) =>
    `Show ${label} in ${document}, page ${page}`,
  fieldSelected: (label: string, page: number) => `Selected ${label}, page ${page}`,

  // Route
  fieldsTitle: "Fields on this form",
  resizeFieldsPanel: "Resize fields panel",
  collapseFieldsPanel: "Collapse fields sidebar",
  expandFieldsPanel: "Expand fields sidebar",
  resizeDetailsPanel: "Resize field details and questions panel",
  viewed: (v: number, n: number) => `${v} of ${n} viewed`,
  findField: "Find a field",
  fieldFilters: "Filter fields",
  allFields: "All",
  requiredFields: "Required",
  explainedFields: "Explained",
  required: "Required",
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
  grounded: "Saved guidance — review date unrecorded",
  general: "General guidance. Check the form's instructions.",
  aiContextMatched: "Question matched with AI. Check it against the form.",
  contextUncertain: "This field's context is unclear",
  contextMissing: "We couldn't reliably match this control to its question or option labels. Check the highlighted field and surrounding instructions on the form.",
  contextNeedsOcr: "This page has no readable PDF text. OCR is needed to identify the question, but OCR isn't enabled. Use a text-based copy or read the original form.",
  contextAiPrivacy: "For blank forms only: this sends nearby printed text and positions to the external AI service, not PDF images or entered field values.",
  contextIdentify: "Identify question with AI",
  contextIdentifying: "Identifying the question...",
  contextStillUncertain: "The AI couldn't make a reliable match. Check the original form; you can retry if needed.",
  contextFailed: "The question couldn't be identified. The AI service may be unavailable or the request timed out. Try again.",
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
  thinking: "Working on your question…",
  preparingAnswer: "Preparing an answer from the verified official pages…",
  chooseFormJurisdiction: "Which government issued this form?",
  chooseJurisdiction: "Which province or territory?",
  selectOption: "Choose an option",
  continueLookup: "Find official information",
  savedLinks: "Saved official links — not checked live",
  officialWebsite: (name: string) => `${name} official website`,
  downloadRestricted: "This official page links to a download outside the permitted domains. The app has not opened or verified that download.",
  aiNotConfigured: "The AI assistant isn't enabled here yet. Field explanations and saved official links are still available.",
  navigatorSuggestions: [
    "How do I renew a passport?",
    "I lost my job. How do I apply for Employment Insurance?",
    "How do I get a Social Insurance Number?",
  ],
  overviewSuggestion: "Give me an overview of this form",
  downloadSuggestion: "Where do I download this form?",
  fieldSuggestion: "What does this field mean?",
  feesSuggestion: "What are the fees for this service?",
  askingAbout: "Asking about:",
  stopAsking: (label: string) => `Stop asking about ${label}`,
  clear: "Clear",
  send: "Send",
  labelsOnly: "Chat shares form metadata and recent messages, not PDF bytes or entered field values. Don't include personal information in messages or filenames.",
  askInEnglish: "",
  questionsTitle: "Questions",
  questionsSub: "Ask about this form or any field on it.",
  formPlaceholder: "Ask about this form or a field…",
  formInputLabel: "Your question",
  navPlaceholder: "Ask about a government service…",
  navInputLabel: "Describe what you need",
  chatError: "Sorry, I couldn't reach the assistant. Please try again.",
  chatTimeout: "The AI response took too long. Please try again.",
  liveSource: (date: string) => `Live official source — retrieved ${date}`,
  googleGroundedSource: (date: string) => `Google Search grounded — searched ${date}; page not checked directly`,
  googleSearchSuggestions: "Google Search suggestions",
  reviewedSnapshot: (date: string) => `Reviewed snapshot — reviewed ${date}; not checked live`,
  unreviewedSavedGuidance: "Saved guidance — review date unrecorded; not checked live",
  lookupStatus: (outcome: OfficialLookupSummary): string => {
    switch (outcome.status) {
      case "verified":
        if (outcome.method === "google_grounding") return `${outcome.fallbackReason ? "The direct lookup could not verify a usable page, so Google Search was used as a fallback. " : ""}This answer cites Google-grounded official-domain sources; the app has not independently fetched those pages.`;
        return outcome.partial
          ? "Some official pages could not be verified; this answer uses only the verified pages."
          : "";
      case "clarification_required":
        if (outcome.publicForm) return "Matching pages cover more than one jurisdiction. Choose the government that issued this form so I can check the right version.";
        return outcome.serviceId
          ? "I know which service you mean. Choose a province or territory so I can check the right official instructions."
          : "I couldn't identify a public form to look up. Open a blank, text-based PDF or send its public title or number, without personal details.";
      case "no_verified_results":
        if (outcome.method === "google_grounding") return "Google Search did not return usable grounding with only permitted official sources. No answer from model memory is shown.";
        return "No verified official result was found for this service and jurisdiction.";
      case "unavailable":
        if (outcome.reason === "search_quota") return "Serper search credits or rate limits have been reached. Check the Serper account before retrying. Saved official links below have not been checked live.";
        if (outcome.reason === "search_auth") return "Serper search authentication failed. The server's search API key needs to be checked. Saved official links below have not been checked live.";
        if (outcome.reason === "search_failed") return "Serper web search is unavailable. Try again later, or open a saved official link below.";
        if (outcome.reason === "grounding_quota") return `${outcome.fallbackReason ? "The direct lookup did not succeed, and the Google fallback is also unavailable. " : ""}Google Search grounding has reached this project's quota. Check Gemini billing and search quota, or try later. Saved official links below have not been checked live.`;
        if (outcome.reason === "grounding_failed") return "Google Search grounding is unavailable. Try again later, or open a saved official link below.";
        if (outcome.method === "google_grounding" && outcome.reason === "deadline") return "Google Search grounding took too long. Try again, or open a saved official link below.";
        if (outcome.reason === "provider_not_configured") return "Live search isn't enabled for this service here yet. You can use the saved official links below, but they haven't been checked live.";
        if (outcome.reason === "deadline") return "The official pages took too long to respond. Try again, or open a saved official link below.";
        return "Current official information could not be verified. Please try again later.";
    }
  },
  incompleteAnswer: "The response was interrupted. Treat any text above as incomplete and try again.",

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
  tooLargeBody: "Please choose a PDF of 10 MB or less.",
  notPdfTitle: "That isn't a PDF",
  notPdfBody: "Please choose a PDF form.",
  sampleFail: "Couldn't load the sample form",
};

export type Dict = typeof en;

const fr: Dict = {
  htmlLang: "fr-CA",
  brand: "formER",
  brandHome: ", accueil",
  otherLangName: "English",
  otherLang: "en",
  newSession: "Nouvelle session",

  heroTitle: "Comprenez les formulaires gouvernementaux, un champ à la fois.",
  heroSub:
    "Téléversez un formulaire gouvernemental et sélectionnez un champ pour obtenir une explication en langage clair. Vous pouvez aussi démarrer une conversation pour obtenir des instructions officielles à jour.",
  startHere: "Commencez ici",
  startChat: "Commencer par le clavardage",
  chatOnlyHint: "Aucun PDF requis. Ajoutez-en un pour ouvrir l'aperçu du formulaire.",
  chatTitle: "Comment pouvons-nous vous aider?",
  chatSub: "Posez une question sur un service gouvernemental ou ajoutez un PDF pour obtenir de l'aide avec un formulaire.",
  chooseFile: "Choisir un fichier",
  sampleCaption:
    "Une copie d'étude d'un formulaire gouvernemental, avec des explications dans la marge. Lorsque vous sélectionnez un champ, formER le relie aux renseignements dont vous avez besoin.",
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
  supported: "Utilisez des PDF vierges avec des champs à remplir. Les formulaires numérisés, aplatis, protégés par mot de passe ou uniquement XFA ne permettent pas d'expliquer les champs.",
  privacyRest:
    "Le PDF est lu dans votre navigateur et n'est pas téléversé. Le clavardage transmet le nom du fichier, les métadonnées et les messages récents au fournisseur d'IA configuré (OpenAI par défaut, ou Google Gemini), pas le PDF ni les valeurs saisies. L'application vérifie d'abord les pages connues et utilise Serper pour trouver d'autres pages officielles au besoin. Serper reçoit les mots-clés du catalogue ou le titre public et le numéro lus sur un formulaire vierge, le sujet, la langue de l'interface et le territoire si connu, jamais l'historique, le nom du fichier ni les valeurs saisies. Utilisez uniquement des formulaires vierges.",
  rulesNotAi: "Le clavardage utilise le fournisseur d'IA configuré (OpenAI par défaut, ou Google Gemini) pour les réponses, sans recherche Web intégrée. L'application vérifie d'abord les pages connues et utilise Serper pour la recherche Web au besoin. Serper reçoit les mots-clés du catalogue ou le titre public et le numéro lus sur un formulaire vierge, le sujet, la langue de l'interface et le territoire si connu, pas l'historique, le nom du fichier ni les valeurs saisies. Utilisez uniquement des formulaires vierges. Les extraits de recherche ne sont pas des preuves : l'application doit consulter et vérifier les pages officielles avant d'utiliser leur contenu dans une réponse.",
  aiPrivacyDetails: "Confidentialité : IA et recherche",
  featuresTitle: "Ce que fait formER",
  features: [
    { title: "Explique chaque champ", body: "Sélectionnez un champ pour obtenir une aide claire." },
    { title: "Renvoie aux pages officielles", body: "Les conseils renvoient aux sources gouvernementales." },
    { title: "Garde votre PDF sur l'appareil", body: "Votre PDF est lu dans votre navigateur, sans téléversement." },
    { title: "Français ou anglais", body: "Changez de langue en tout temps." },
  ],
  dataDetails: "Utilisation des données par le clavardage et la recherche",
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
  noServiceMatch: "Aucun service correspondant. Essayez passeport, prestations ou impôt.",
  serviceResults: (n) => `${n} service${n === 1 ? "" : "s"} trouvé${n === 1 ? "" : "s"}`,
  serviceIndex: {
    passports: "Obtenir ou renouveler un passeport",
    sin: "Demander un numéro d'assurance sociale",
    ei: "J'ai perdu mon emploi : assurance-emploi",
    ccb: "Prestations pour mes enfants",
    cpp: "Pension de retraite (RPC)",
    oas: "Sécurité de la vieillesse",
    "cra-sign-in": "Me connecter à mon dossier de l'ARC",
  },
  serviceDepartments: {
    passports: "IRCC", sin: "EDSC", ei: "EDSC", ccb: "ARC",
    cpp: "EDSC", oas: "EDSC", "cra-sign-in": "ARC",
  },
  footer:
    "Prototype de hackathon non officiel, sans affiliation avec un gouvernement. Les explications sont des renseignements généraux, pas des conseils juridiques. Consultez les instructions officielles liées.",

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
  opensNewTab: " (ouvre un site officiel du gouvernement dans un nouvel onglet)",

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
  showFieldReference: (document, page, label) => `Afficher ${label} dans ${document}, page ${page}`,
  fieldSelected: (label, page) => `${label} sélectionné, page ${page}`,

  fieldsTitle: "Champs de ce formulaire",
  resizeFieldsPanel: "Redimensionner le panneau des champs",
  collapseFieldsPanel: "Réduire le panneau des champs",
  expandFieldsPanel: "Déployer le panneau des champs",
  resizeDetailsPanel: "Redimensionner le panneau des détails et des questions",
  viewed: (v, n) => `${v} sur ${n} consultés`,
  findField: "Trouver un champ",
  fieldFilters: "Filtrer les champs",
  allFields: "Tous",
  requiredFields: "Obligatoires",
  explainedFields: "Expliqués",
  required: "Obligatoire",
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
  grounded: "Conseils enregistrés — date de révision non consignée",
  general: "Conseil général. Vérifiez les instructions du formulaire.",
  aiContextMatched: "Question associée par l'IA. Vérifiez-la sur le formulaire.",
  contextUncertain: "Le contexte de ce champ est incertain",
  contextMissing: "Impossible d'associer ce contrôle à sa question ou à ses choix de façon fiable. Consultez le champ surligné et les instructions du formulaire.",
  contextNeedsOcr: "Cette page n'a pas de texte PDF lisible. La reconnaissance de caractères est nécessaire, mais elle n'est pas activée. Utilisez une copie avec du texte ou consultez l'original.",
  contextAiPrivacy: "Formulaires vierges seulement : le texte imprimé à proximité et ses positions sont transmis au service d'IA externe, sans images PDF ni valeurs saisies.",
  contextIdentify: "Identifier la question avec l'IA",
  contextIdentifying: "Identification de la question...",
  contextStillUncertain: "L'IA n'a pas trouvé d'association fiable. Consultez l'original; vous pouvez réessayer au besoin.",
  contextFailed: "Impossible d'identifier la question. Le service d'IA est peut-être indisponible ou le délai est dépassé. Réessayez.",
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
  thinking: "Traitement de votre question…",
  preparingAnswer: "Préparation d'une réponse à partir des pages officielles vérifiées…",
  chooseFormJurisdiction: "Quel gouvernement a publié ce formulaire ?",
  chooseJurisdiction: "Quelle province ou quel territoire ?",
  selectOption: "Choisir une option",
  continueLookup: "Trouver les renseignements officiels",
  savedLinks: "Liens officiels enregistrés — non vérifiés en direct",
  officialWebsite: (name) => `Site officiel : ${name}`,
  downloadRestricted: "Cette page officielle renvoie à un téléchargement hors des domaines autorisés. L'application n'a pas ouvert ni vérifié ce téléchargement.",
  aiNotConfigured: "L'assistant IA n'est pas encore activé ici. Les explications des champs et les liens officiels enregistrés restent disponibles.",
  navigatorSuggestions: [
    "Comment renouveler mon passeport ?",
    "J'ai perdu mon emploi. Comment demander l'assurance-emploi ?",
    "Comment obtenir un numéro d'assurance sociale ?",
  ],
  overviewSuggestion: "Donne-moi un aperçu de ce formulaire",
  downloadSuggestion: "Où télécharger ce formulaire ?",
  fieldSuggestion: "Que signifie ce champ ?",
  feesSuggestion: "Quels sont les frais de ce service ?",
  askingAbout: "Question sur :",
  stopAsking: (label) => `Ne plus poser de question sur ${label}`,
  clear: "Effacer",
  send: "Envoyer",
  labelsOnly: "Le clavardage partage les métadonnées et les messages récents, pas le PDF ni les valeurs saisies. N'incluez pas de renseignements personnels dans les messages ou les noms de fichiers.",
  askInEnglish: "",
  questionsTitle: "Questions",
  questionsSub: "Posez une question sur ce formulaire ou l'un de ses champs.",
  formPlaceholder: "Posez une question sur ce formulaire ou un champ…",
  formInputLabel: "Votre question",
  navPlaceholder: "Posez une question sur un service gouvernemental…",
  navInputLabel: "Décrivez votre besoin",
  chatError: "Désolé, impossible de joindre l'assistant. Veuillez réessayer.",
  chatTimeout: "La réponse de l'IA a pris trop de temps. Veuillez réessayer.",
  liveSource: (date: string) => `Source officielle en direct — consultée le ${date}`,
  googleGroundedSource: (date: string) => `Source via Google Search — recherche le ${date} ; page non consultée directement`,
  googleSearchSuggestions: "Suggestions de Google Search",
  reviewedSnapshot: (date: string) => `Copie révisée — révisée le ${date} ; non vérifiée en direct`,
  unreviewedSavedGuidance: "Conseils enregistrés — date de révision non consignée ; non vérifiés en direct",
  lookupStatus: (outcome: OfficialLookupSummary): string => {
    switch (outcome.status) {
      case "verified":
        if (outcome.method === "google_grounding") return `${outcome.fallbackReason ? "La vérification directe n'a pas fourni de page exploitable ; Google Search a servi de solution de repli. " : ""}Cette réponse cite des sources officielles appuyées par Google. L'application n'a pas consulté ces pages directement.`;
        return outcome.partial
          ? "Certaines pages officielles n’ont pas pu être vérifiées ; cette réponse utilise uniquement les pages vérifiées."
          : "";
      case "clarification_required":
        if (outcome.publicForm) return "Les pages trouvées concernent plusieurs territoires. Choisissez le gouvernement qui a publié ce formulaire pour vérifier la bonne version.";
        return outcome.serviceId
          ? "Le service est identifié. Choisissez une province ou un territoire pour vérifier les bonnes instructions officielles."
          : "Le formulaire public n'a pas pu être identifié. Ouvrez un PDF vierge contenant du texte ou envoyez son titre public ou son numéro, sans renseignements personnels.";
      case "no_verified_results":
        if (outcome.method === "google_grounding") return "Google Search n'a pas fourni de réponse exploitable citant uniquement des sources officielles autorisées. Aucune réponse issue de la mémoire du modèle n'est affichée.";
        return "Aucun résultat officiel vérifié n’a été trouvé pour ce service et ce territoire de compétence.";
      case "unavailable":
        if (outcome.reason === "search_quota") return "Les crédits ou les limites de recherche Serper sont atteints. Vérifiez le compte Serper avant de réessayer. Les liens officiels enregistrés ci-dessous n'ont pas été vérifiés en direct.";
        if (outcome.reason === "search_auth") return "L'authentification de recherche Serper a échoué. La clé de recherche du serveur doit être vérifiée. Les liens officiels enregistrés ci-dessous n'ont pas été vérifiés en direct.";
        if (outcome.reason === "search_failed") return "La recherche Web Serper est indisponible. Réessayez plus tard ou ouvrez un lien officiel enregistré ci-dessous.";
        if (outcome.reason === "grounding_quota") return `${outcome.fallbackReason ? "La vérification directe a échoué et la solution de repli Google est aussi indisponible. " : ""}Le quota Google Search du projet est atteint. Vérifiez la facturation et le quota de recherche Gemini, ou réessayez plus tard. Les liens enregistrés ci-dessous n'ont pas été vérifiés en direct.`;
        if (outcome.reason === "grounding_failed") return "Google Search est indisponible. Réessayez plus tard ou ouvrez un lien officiel enregistré ci-dessous.";
        if (outcome.method === "google_grounding" && outcome.reason === "deadline") return "Google Search a mis trop de temps à répondre. Réessayez ou ouvrez un lien officiel enregistré ci-dessous.";
        if (outcome.reason === "provider_not_configured") return "La recherche en direct n'est pas encore activée pour ce service ici. Les liens officiels enregistrés ci-dessous n'ont pas été vérifiés en direct.";
        if (outcome.reason === "deadline") return "Les pages officielles ont mis trop de temps à répondre. Réessayez ou ouvrez un lien officiel enregistré ci-dessous.";
        return "Les renseignements officiels actuels n’ont pas pu être vérifiés. Veuillez réessayer plus tard.";
    }
  },
  incompleteAnswer: "La réponse a été interrompue. Le texte ci-dessus est incomplet ; veuillez réessayer.",

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
  tooLargeBody: "Choisissez un PDF de 10 Mo ou moins.",
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
