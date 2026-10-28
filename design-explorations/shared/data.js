/*
 * Shared prototype content for the five design directions.
 * Field explanations are copied from web/src/lib/catalog/forms.ts (PPTC 153 rules).
 * French copy is a draft translation for comparison only and needs review.
 * Source URLs come from web/src/lib/catalog/resources.ts (verified 2026-10-28).
 */
(function () {
  const PASSPORTS = "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports";

  const resources = {
    "passport-citizenship-proof": {
      url: `${PASSPORTS}/new-adult-passport/citizenship-proof.html`,
      en: "Proof of Canadian citizenship for a passport",
      fr: "Preuve de citoyenneté canadienne pour un passeport",
    },
    "passport-change-name": {
      url: `${PASSPORTS}/change-name.html`,
      en: "Change the name in your passport",
      fr: "Changer le nom dans votre passeport",
    },
    "passport-submit": {
      url: `${PASSPORTS}/new-adult-passport/apply-submit-fees.html`,
      en: "Submit your passport application and pay the fees",
      fr: "Présenter votre demande de passeport et payer les frais",
    },
    "passport-required-docs": {
      url: `${PASSPORTS}/new-adult-passport/required-documents-photos.html`,
      en: "What you need to apply for an adult passport",
      fr: "Ce dont vous avez besoin pour demander un passeport pour adulte",
    },
    "passport-renew": {
      url: `${PASSPORTS}/renew-adult-passport.html`,
      en: "Renew an adult passport",
      fr: "Renouveler un passeport pour adulte",
    },
    "passport-fees": {
      url: `${PASSPORTS}/fees.html`,
      en: "Passport fees",
      fr: "Frais de passeport",
    },
    passports: {
      url: `${PASSPORTS}.html`,
      en: "Canadian passports",
      fr: "Passeports canadiens",
    },
    sin: {
      url: "https://www.canada.ca/en/employment-social-development/services/sin.html",
      en: "Social Insurance Number (SIN)",
      fr: "Numéro d'assurance sociale (NAS)",
    },
    ei: {
      url: "https://www.canada.ca/en/services/benefits/ei.html",
      en: "Employment Insurance (EI)",
      fr: "Assurance-emploi (AE)",
    },
    ccb: {
      url: "https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit.html",
      en: "Canada child benefit",
      fr: "Allocation canadienne pour enfants",
    },
    cpp: {
      url: "https://www.canada.ca/en/services/benefits/publicpensions/cpp.html",
      en: "Canada Pension Plan (CPP)",
      fr: "Régime de pensions du Canada (RPC)",
    },
    oas: {
      url: "https://www.canada.ca/en/services/benefits/publicpensions/old-age-security.html",
      en: "Old Age Security (OAS)",
      fr: "Sécurité de la vieillesse (SV)",
    },
    "cra-sign-in": {
      url: "https://www.canada.ca/en/revenue-agency/services/e-services/cra-login-services.html",
      en: "CRA sign-in services (My Account)",
      fr: "Services d'ouverture de session de l'ARC (Mon dossier)",
    },
  };

  const sections = {
    personal: { en: "1 · Personal information", fr: "1 · Renseignements personnels" },
    travel: { en: "Travel", fr: "Voyage" },
    guarantor: { en: "2 · Guarantor declaration", fr: "2 · Déclaration du répondant" },
  };

  const GUARANTOR = {
    meaning: {
      en: "Your guarantor confirms who you are. You or your guarantor can fill in this section, but the 4 bold fields (passport details) must be completed by the guarantor.",
      fr: "Votre répondant confirme votre identité. Vous ou votre répondant pouvez remplir cette section, mais les 4 champs en gras (renseignements sur le passeport) doivent être remplis par le répondant.",
    },
    points: {
      en: {
        title: "Who can be your guarantor",
        items: [
          "18 or older and has known you personally for at least 2 years",
          "A Canadian citizen",
          "Has a 5- or 10-year Canadian passport that is valid or expired for less than 1 year",
          "Was 16 or older when they applied for that passport",
          "Can communicate in English or French and is available if the Passport Program contacts them",
        ],
      },
      fr: {
        title: "Qui peut être votre répondant",
        items: [
          "A 18 ans ou plus et vous connaît personnellement depuis au moins 2 ans",
          "Est citoyen canadien",
          "A un passeport canadien de 5 ou 10 ans valide ou expiré depuis moins d'un an",
          "Avait 16 ans ou plus lorsqu'il a demandé ce passeport",
          "Peut communiquer en français ou en anglais et est disponible si le Programme de passeport communique avec lui",
        ],
      },
    },
    mistakes: {
      en: [
        "Using a guarantor whose passport expired more than 1 year ago",
        "Filling in the bold passport fields yourself instead of your guarantor",
        "Forgetting the guarantor's signature on a photo",
      ],
      fr: [
        "Choisir un répondant dont le passeport est expiré depuis plus d'un an",
        "Remplir vous-même les champs en gras au lieu de votre répondant",
        "Oublier la signature du répondant sur une photo",
      ],
    },
  };

  /** type: text | date | choose */
  const fields = [
    {
      id: "surname", page: 1, section: "personal", type: "text", grounded: true,
      en: {
        label: "Surname (last name)",
        meaning: "Your family name, exactly as you want it printed in your passport.",
        enter: "Write your surname in CAPITAL LETTERS. It must match your proof of citizenship, or the legal documents that changed your name.",
        example: "TREMBLAY",
        find: "Birth certificate or citizenship certificate, plus any legal name-change documents.",
        mistakes: ["Using a nickname or a spelling your documents don't support", "Swapping your surname and given names"],
      },
      fr: {
        label: "Nom de famille",
        meaning: "Votre nom de famille, exactement comme vous voulez qu'il figure dans votre passeport.",
        enter: "Écrivez votre nom de famille en MAJUSCULES. Il doit correspondre à votre preuve de citoyenneté ou aux documents légaux qui ont changé votre nom.",
        example: "TREMBLAY",
        find: "Certificat de naissance ou certificat de citoyenneté, ainsi que tout document légal de changement de nom.",
        mistakes: ["Utiliser un surnom ou une orthographe que vos documents ne confirment pas", "Inverser votre nom de famille et vos prénoms"],
      },
      sources: ["passport-citizenship-proof", "passport-change-name"],
    },
    {
      id: "given", page: 1, section: "personal", type: "text", grounded: true,
      en: {
        label: "Given name(s)",
        meaning: "Your first name and any middle names, as you want them printed in your passport.",
        enter: "Write all given names in CAPITAL LETTERS, in the same order as on your proof of citizenship.",
        example: "MARIE CLAIRE",
        find: "Birth certificate or citizenship certificate.",
        mistakes: ["Leaving out middle names that appear on your documents"],
      },
      fr: {
        label: "Prénom(s)",
        meaning: "Votre prénom et vos autres prénoms, comme vous voulez qu'ils figurent dans votre passeport.",
        enter: "Écrivez tous vos prénoms en MAJUSCULES, dans le même ordre que sur votre preuve de citoyenneté.",
        example: "MARIE CLAIRE",
        find: "Certificat de naissance ou certificat de citoyenneté.",
        mistakes: ["Omettre des seconds prénoms qui figurent sur vos documents"],
      },
      sources: ["passport-citizenship-proof"],
    },
    {
      id: "former", page: 1, section: "personal", type: "text", grounded: true,
      en: {
        label: "Former surnames",
        meaning: "Any surnames you used before, including your surname at birth if it's different. These won't appear in your passport.",
        enter: "List every former surname, separated by commas. Leave it blank if you've never had another surname.",
        example: "GAGNON, SMITH",
        mistakes: ["Forgetting a surname used before marriage or adoption"],
      },
      fr: {
        label: "Noms de famille antérieurs",
        meaning: "Tous les noms de famille que vous avez utilisés auparavant, y compris votre nom à la naissance s'il est différent. Ils ne figureront pas dans votre passeport.",
        enter: "Inscrivez chaque nom antérieur, séparé par une virgule. Laissez vide si vous n'avez jamais eu d'autre nom de famille.",
        example: "GAGNON, SMITH",
        mistakes: ["Oublier un nom utilisé avant un mariage ou une adoption"],
      },
      sources: ["passport-change-name"],
    },
    {
      id: "parents", page: 1, section: "personal", type: "text", grounded: false,
      en: {
        label: "Surname of parent(s) at their birth",
        meaning: "The surname each of your parents had when they were born.",
        enter: "Write your parents' surnames at birth, which may differ from their current surnames.",
        find: "A long-form birth certificate often lists parents' names; otherwise ask a family member.",
        mistakes: ["Entering a parent's married name instead of their surname at birth"],
      },
      fr: {
        label: "Nom de famille du ou des parents à leur naissance",
        meaning: "Le nom de famille de chacun de vos parents à sa naissance.",
        enter: "Écrivez le nom de famille de vos parents à leur naissance, qui peut différer de leur nom actuel.",
        find: "Le certificat de naissance détaillé indique souvent le nom des parents; sinon, demandez à un membre de votre famille.",
        mistakes: ["Inscrire le nom d'un parent après son mariage plutôt que son nom à la naissance"],
      },
      sources: [],
    },
    {
      id: "dob", page: 1, section: "personal", type: "date", grounded: true,
      en: {
        label: "Date of birth",
        meaning: "The date you were born.",
        enter: "Use the format shown on the form: year, month, day.",
        example: "1990-04-15 (YYYY-MM-DD)",
        find: "Birth certificate or citizenship certificate.",
        mistakes: ["Writing the date as DD-MM-YYYY or MM-DD-YYYY"],
      },
      fr: {
        label: "Date de naissance",
        meaning: "La date à laquelle vous êtes né(e).",
        enter: "Utilisez le format indiqué sur le formulaire : année, mois, jour.",
        example: "1990-04-15 (AAAA-MM-JJ)",
        find: "Certificat de naissance ou certificat de citoyenneté.",
        mistakes: ["Écrire la date au format JJ-MM-AAAA ou MM-JJ-AAAA"],
      },
      sources: ["passport-citizenship-proof"],
    },
    {
      id: "sex", page: 1, section: "personal", type: "choose", grounded: true,
      options: { en: ["F · Female", "M · Male", "X · Another gender"], fr: ["F · Féminin", "M · Masculin", "X · Autre genre"] },
      en: {
        label: "Sex",
        meaning: "The sex or gender identifier you want displayed in your passport.",
        enter: "Select F (female), M (male) or X (another gender).",
        mistakes: ["Selecting more than one option"],
      },
      fr: {
        label: "Sexe",
        meaning: "L'identifiant de sexe ou de genre que vous voulez voir dans votre passeport.",
        enter: "Cochez F (féminin), M (masculin) ou X (autre genre).",
        mistakes: ["Cocher plus d'une case"],
      },
      sources: ["passports"],
    },
    {
      id: "eye", page: 1, section: "personal", type: "text", grounded: true,
      en: {
        label: "Eye colour",
        meaning: "Your natural eye colour. It's used as a physical description.",
        enter: "Write a simple colour word.",
        example: "BROWN, BLUE, GREEN, HAZEL or GREY",
        mistakes: ["Describing tinted contact lenses instead of your natural colour"],
      },
      fr: {
        label: "Couleur des yeux",
        meaning: "La couleur naturelle de vos yeux. Elle sert à votre description physique.",
        enter: "Écrivez un mot simple pour la couleur.",
        example: "BRUNS, BLEUS, VERTS, NOISETTE ou GRIS",
        mistakes: ["Décrire des lentilles teintées plutôt que votre couleur naturelle"],
      },
      sources: [],
    },
    {
      id: "height", page: 1, section: "personal", type: "text", grounded: true,
      en: {
        label: "Height",
        meaning: "How tall you are. It's used as a physical description.",
        enter: "Enter your height and include the unit (cm or in).",
        example: "170 cm or 5 ft 7 in",
        mistakes: ["Leaving out the unit"],
      },
      fr: {
        label: "Taille",
        meaning: "Votre taille. Elle sert à votre description physique.",
        enter: "Indiquez votre taille avec l'unité (cm ou po).",
        example: "170 cm ou 5 pi 7 po",
        mistakes: ["Oublier l'unité"],
      },
      sources: [],
    },
    {
      id: "pob", page: 1, section: "personal", type: "text", grounded: true,
      en: {
        label: "Place of birth",
        meaning: "The city, country and province, territory or state where you were born.",
        enter: "Enter it exactly as it appears on your birth certificate or citizenship certificate.",
        example: "WINNIPEG · CANADA · MB",
        find: "Proof of citizenship (birth certificate or citizenship certificate).",
        mistakes: [],
      },
      fr: {
        label: "Lieu de naissance",
        meaning: "La ville, le pays et la province, le territoire ou l'État où vous êtes né(e).",
        enter: "Inscrivez-le exactement comme sur votre certificat de naissance ou de citoyenneté.",
        example: "WINNIPEG · CANADA · MB",
        find: "Preuve de citoyenneté (certificat de naissance ou de citoyenneté).",
        mistakes: [],
      },
      sources: ["passport-citizenship-proof"],
    },
    {
      id: "travel", page: 1, section: "travel", type: "choose", grounded: true,
      options: { en: ["Date (enter below)", "Unknown"], fr: ["Date (inscrire ci-dessous)", "Inconnue"] },
      en: {
        label: "Anticipated date of travel",
        meaning: "When you plan to travel, so the Passport Program knows when you need the passport.",
        enter: "Choose a date and enter the month and day, or choose Unknown if you have no travel plans.",
        example: "Month 07, Day 15",
        mistakes: ["Booking non-refundable travel before your passport arrives. The form recommends waiting."],
      },
      fr: {
        label: "Date prévue du voyage",
        meaning: "Quand vous prévoyez voyager, pour que le Programme de passeport sache quand vous avez besoin du passeport.",
        enter: "Choisissez une date et inscrivez le mois et le jour, ou choisissez Inconnue si vous n'avez pas de projet de voyage.",
        example: "Mois 07, jour 15",
        mistakes: ["Réserver un voyage non remboursable avant de recevoir votre passeport. Le formulaire recommande d'attendre."],
      },
      sources: ["passport-submit"],
    },
    {
      id: "g-surname", page: 3, section: "guarantor", type: "text", grounded: true, guarantor: true,
      en: {
        label: "Guarantor: surname in passport",
        enter: "Your guarantor's surname, exactly as it appears in their Canadian passport.",
        find: "Guarantor's Canadian passport.",
      },
      fr: {
        label: "Répondant : nom de famille dans le passeport",
        enter: "Le nom de famille de votre répondant, exactement comme dans son passeport canadien.",
        find: "Passeport canadien du répondant.",
      },
      sources: ["passport-required-docs"],
    },
    {
      id: "g-number", page: 3, section: "guarantor", type: "text", grounded: true, guarantor: true, bold: true,
      en: {
        label: "Guarantor: Canadian passport number",
        enter: "Your guarantor must write their own passport number.",
        example: "AB123456",
        find: "Guarantor's Canadian passport (the page with their photo).",
      },
      fr: {
        label: "Répondant : numéro de passeport canadien",
        enter: "Votre répondant doit écrire lui-même son numéro de passeport.",
        example: "AB123456",
        find: "Passeport canadien du répondant (la page avec sa photo).",
      },
      sources: ["passport-required-docs"],
    },
    {
      id: "g-issue", page: 3, section: "guarantor", type: "date", grounded: true, guarantor: true, bold: true,
      en: {
        label: "Guarantor: passport date of issue",
        enter: "Your guarantor must write the date their passport was issued.",
        example: "2021-06-01 (YYYY-MM-DD)",
      },
      fr: {
        label: "Répondant : date de délivrance du passeport",
        enter: "Votre répondant doit écrire la date de délivrance de son passeport.",
        example: "2021-06-01 (AAAA-MM-JJ)",
      },
      sources: ["passport-required-docs"],
    },
    {
      id: "g-expiry", page: 3, section: "guarantor", type: "date", grounded: true, guarantor: true, bold: true,
      en: {
        label: "Guarantor: passport date of expiry",
        enter: "Your guarantor must write the date their passport expires.",
        example: "2031-06-01 (YYYY-MM-DD)",
      },
      fr: {
        label: "Répondant : date d'expiration du passeport",
        enter: "Votre répondant doit écrire la date d'expiration de son passeport.",
        example: "2031-06-01 (AAAA-MM-JJ)",
      },
      sources: ["passport-required-docs"],
    },
  ];

  for (const f of fields) {
    if (!f.guarantor) continue;
    f.en.meaning = GUARANTOR.meaning.en;
    f.fr.meaning = GUARANTOR.meaning.fr;
    f.en.points = GUARANTOR.points.en;
    f.fr.points = GUARANTOR.points.fr;
    f.en.mistakes = GUARANTOR.mistakes.en;
    f.fr.mistakes = GUARANTOR.mistakes.fr;
  }

  const docs = [
    {
      id: "pptc153", lang: "en", number: "PPTC 153", pages: 8,
      title: { en: "Adult General Passport Application", fr: "Demande de passeport général pour adultes (anglais)" },
      short: { en: "Adult passport · EN", fr: "Passeport adulte · EN" },
    },
    {
      id: "pptc154", lang: "fr", number: "PPTC 154", pages: 8,
      title: { en: "Adult General Passport Application (French)", fr: "Demande de passeport général pour adultes" },
      short: { en: "Adult passport · FR", fr: "Passeport adulte · FR" },
    },
  ];

  const overview = {
    en: {
      title: "Adult General Passport Application",
      department: "IRCC – Passport Program",
      summary: "Use this form to apply for a new Canadian passport if you are 16 or older and applying in Canada or the USA. If you already have an adult passport, you may be able to renew instead, which is simpler.",
      who: "Canadian citizens aged 16 or older, applying in Canada or the USA.",
      need: [
        "Proof of Canadian citizenship (original birth certificate or citizenship certificate)",
        "At least 1 document to support your identity, such as a driver's licence or health card",
        "2 identical passport photos (your guarantor signs 1)",
        "A guarantor who has known you for 2+ years",
        "2 references who aren't relatives",
        "Your current passport, if it's still valid",
      ],
      submit: "In person at a passport office or Service Canada Centre, or by mail. The best option depends on when you need your passport.",
    },
    fr: {
      title: "Demande de passeport général pour adultes",
      department: "IRCC – Programme de passeport",
      summary: "Utilisez ce formulaire pour demander un nouveau passeport canadien si vous avez 16 ans ou plus et présentez votre demande au Canada ou aux États-Unis. Si vous avez déjà un passeport pour adulte, vous pourriez plutôt le renouveler, ce qui est plus simple.",
      who: "Citoyens canadiens de 16 ans ou plus qui présentent leur demande au Canada ou aux États-Unis.",
      need: [
        "Preuve de citoyenneté canadienne (certificat de naissance ou de citoyenneté original)",
        "Au moins 1 document à l'appui de votre identité, comme un permis de conduire ou une carte santé",
        "2 photos de passeport identiques (votre répondant en signe 1)",
        "Un répondant qui vous connaît depuis au moins 2 ans",
        "2 références qui ne sont pas des membres de votre famille",
        "Votre passeport actuel, s'il est encore valide",
      ],
      submit: "En personne dans un bureau des passeports ou un Centre Service Canada, ou par la poste. La meilleure option dépend du moment où vous avez besoin de votre passeport.",
    },
    sources: ["passport-required-docs", "passport-submit", "passport-renew", "passport-fees"],
  };

  const services = [
    { id: "passports", en: "Get or renew a passport", fr: "Obtenir ou renouveler un passeport", dept: "IRCC" },
    { id: "sin", en: "Apply for a Social Insurance Number", fr: "Demander un numéro d'assurance sociale", dept: "ESDC" },
    { id: "ei", en: "I lost my job: Employment Insurance", fr: "J'ai perdu mon emploi : assurance-emploi", dept: "ESDC" },
    { id: "ccb", en: "Benefits for my children", fr: "Prestations pour mes enfants", dept: "CRA" },
    { id: "cpp", en: "Retirement pension (CPP)", fr: "Pension de retraite (RPC)", dept: "ESDC" },
    { id: "oas", en: "Old Age Security", fr: "Sécurité de la vieillesse", dept: "ESDC" },
    { id: "cra-sign-in", en: "Sign in to my CRA account", fr: "Ouvrir une session à l'ARC", dept: "CRA" },
  ];

  const i18n = {
    en: {
      brand: "Form Helper",
      notOfficial: "Independent tool. Not a Government of Canada service.",
      notOfficialLong: "Independent hackathon tool, not affiliated with the Government of Canada. Explanations are general information, not legal advice. Check official instructions before you submit.",
      privacy: "Use a blank form. Don't type personal information into chat.",
      aiDisclosure: "Blank-form text and your questions are sent to an AI service to write answers. Answers cite official government sources.",
      heroTitle: "Understand a government form, one field at a time.",
      heroSub: "Open a blank federal form, select any field, and get a plain-language explanation with the official source behind it.",
      uploadTitle: "Open a blank PDF",
      uploadHint: "Drop a PDF here or choose a file",
      limits: "Up to 5 PDFs · 25 MB and 30 pages each · blank fillable federal forms",
      supported: "Verified so far: Adult passport application (PPTC 153 English, PPTC 154 French).",
      sampleTitle: "Try a sample form",
      sampleEn: "Adult passport application",
      sampleFr: "Demande de passeport pour adultes",
      serviceTitle: "Find a government service",
      serviceSub: "No form yet? Describe what you need and get official next steps.",
      servicePh: "What do you need to do? For example, renew my passport",
      fieldsTitle: "Fields on this form",
      askingAbout: "Asking about",
      clear: "Clear",
      chatTitle: "Ask about this form",
      chatPh: "Ask about this form or a field…",
      meaning: "What it means",
      enter: "What to enter",
      example: "Example (fictional)",
      find: "Where to find it",
      mistakes: "Common mistakes",
      options: "Options",
      sources: "Official sources",
      grounded: "From the official guide",
      general: "General guidance. Check the form's instructions.",
      checked: "Checked 2026-10-28",
      askField: "Ask about this field",
      prev: "Previous field",
      next: "Next field",
      page: "Page",
      of: "of",
      newSession: "New session",
      addPdf: "Add PDF",
      docsCount: "{n} of 5 documents",
      viewed: "viewed",
      selectPrompt: "Select a field on the form, or pick one from the list.",
      send: "Send",
      sourceLang: "",
      protoReply: "Prototype reply",
      overviewTitle: "Form overview",
      who: "Who files it",
      need: "You'll need",
      submit: "How to submit",
      pageNotMocked: "This page isn't part of the prototype.",
      search: "Search",
      go: "Find services",
      sample: "Sample",
      openSample: "Open sample",
      langName: "Français",
      required: "Must be filled by guarantor",
      thinking: "Finding the official answer…",
      suggestion1: "Who can be my guarantor?",
      suggestion2: "Where do I put my date of birth?",
      suggestion3: "How much does a passport cost?",
    },
    fr: {
      brand: "Aide-formulaires",
      notOfficial: "Outil indépendant. Pas un service du gouvernement du Canada.",
      notOfficialLong: "Outil de hackathon indépendant, non affilié au gouvernement du Canada. Les explications sont de l'information générale, pas des conseils juridiques. Vérifiez les instructions officielles avant de soumettre.",
      privacy: "Utilisez un formulaire vierge. N'inscrivez aucun renseignement personnel dans le clavardage.",
      aiDisclosure: "Le texte du formulaire vierge et vos questions sont envoyés à un service d'IA pour rédiger les réponses. Les réponses citent des sources gouvernementales officielles.",
      heroTitle: "Comprenez un formulaire gouvernemental, un champ à la fois.",
      heroSub: "Ouvrez un formulaire fédéral vierge, sélectionnez un champ et obtenez une explication en langage clair, avec la source officielle.",
      uploadTitle: "Ouvrir un PDF vierge",
      uploadHint: "Déposez un PDF ici ou choisissez un fichier",
      limits: "Jusqu'à 5 PDF · 25 Mo et 30 pages chacun · formulaires fédéraux vierges et remplissables",
      supported: "Vérifiés jusqu'ici : Demande de passeport pour adultes (PPTC 153 en anglais, PPTC 154 en français).",
      sampleTitle: "Essayer un formulaire exemple",
      sampleEn: "Adult passport application",
      sampleFr: "Demande de passeport pour adultes",
      serviceTitle: "Trouver un service gouvernemental",
      serviceSub: "Pas encore de formulaire? Décrivez votre besoin et obtenez les prochaines étapes officielles.",
      servicePh: "Que voulez-vous faire? Par exemple, renouveler mon passeport",
      fieldsTitle: "Champs de ce formulaire",
      askingAbout: "Question sur",
      clear: "Effacer",
      chatTitle: "Poser une question sur ce formulaire",
      chatPh: "Posez une question sur ce formulaire ou un champ…",
      meaning: "Ce que ça veut dire",
      enter: "Quoi inscrire",
      example: "Exemple (fictif)",
      find: "Où le trouver",
      mistakes: "Erreurs fréquentes",
      options: "Choix",
      sources: "Sources officielles",
      grounded: "Selon le guide officiel",
      general: "Conseil général. Vérifiez les instructions du formulaire.",
      checked: "Vérifié le 2026-10-28",
      askField: "Poser une question sur ce champ",
      prev: "Champ précédent",
      next: "Champ suivant",
      page: "Page",
      of: "de",
      newSession: "Nouvelle session",
      addPdf: "Ajouter un PDF",
      docsCount: "{n} documents sur 5",
      viewed: "consultés",
      selectPrompt: "Sélectionnez un champ sur le formulaire ou dans la liste.",
      send: "Envoyer",
      sourceLang: "Page en anglais (version française à vérifier)",
      protoReply: "Réponse du prototype",
      overviewTitle: "Aperçu du formulaire",
      who: "Qui le remplit",
      need: "Ce qu'il vous faut",
      submit: "Comment le soumettre",
      pageNotMocked: "Cette page ne fait pas partie du prototype.",
      search: "Rechercher",
      go: "Trouver des services",
      sample: "Exemple",
      openSample: "Ouvrir l'exemple",
      langName: "English",
      required: "À remplir par le répondant",
      thinking: "Recherche de la réponse officielle…",
      suggestion1: "Qui peut être mon répondant?",
      suggestion2: "Où inscrire ma date de naissance?",
      suggestion3: "Combien coûte un passeport?",
    },
  };

  window.FH_DATA = { resources, sections, fields, docs, overview, services, i18n, checked: "2026-10-28" };
})();
