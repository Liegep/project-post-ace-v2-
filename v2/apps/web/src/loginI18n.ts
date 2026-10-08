import { useEffect, useState } from "react";

export const LOGIN_LOCALES = ["pt", "en", "it", "es", "sv"] as const;
export type LoginLocale = typeof LOGIN_LOCALES[number];
export const LOGIN_LOCALE_KEY = "designhub-login-language";
export const LOGIN_INTRO_KEY = "designhub-login-intro-played";
export const LOGIN_LANGUAGE_NAMES: Record<LoginLocale, string> = { pt: "Português", en: "English", it: "Italiano", es: "Español", sv: "Svenska" };

const portuguese = {
  "kicker": "DESIGN HUB · SEU ESPAÇO CRIATIVO",
  "welcome": "Bem-vindo ao seu espaço criativo.",
  "intro": "Acesse para acompanhar projetos, conteúdos e aprovações em um só lugar.",
  "recoveryTitle": "Recupere seu acesso.",
  "recoveryIntro": "Digite seu e-mail e enviaremos um link temporário para você criar uma nova senha.",
  "email": "E-mail",
  "emailPlaceholder": "Digite seu e-mail",
  "password": "Senha",
  "passwordPlaceholder": "Digite sua senha",
  "signIn": "Entrar no Design Hub",
  "forgot": "Esqueci minha senha",
  "back": "Voltar para o login",
  "sending": "Enviando…",
  "signingIn": "Entrando…",
  "sendLink": "Enviar link seguro",
  "security": "Acesso protegido ao seu workspace",
  "overview": "Visão geral do Design Hub",
  "vision": "VISÃO COMPLETA",
  "allInOne": "Tudo em um só lugar.",
  "showcase": "Projetos, conteúdos e decisões organizados para uma experiência simples e transparente.",
  "today": "HOJE",
  "greeting": "Olá, seja bem-vindo",
  "happening": "Acompanhe tudo o que está acontecendo",
  "creation": "Em criação",
  "approvals": "Aprovações",
  "scheduled": "Agendados",
  "activity": "Atividade recente",
  "live": "AO VIVO",
  "approved": "Conteúdo aprovado",
  "newClient": "Novo Cliente · agora",
  "newIdea": "Nova pauta adicionada",
  "team": "Equipe criativa · 8 min",
  "changed": "Alteração solicitada",
  "campaign": "Campanha de agosto · 14 min",
  "operational": "Sistema operacional",
  "language": "Idioma",
  "loginError": "Não consegui autenticar na API real nem no fallback local.",
  "recoveryError": "Não foi possível enviar o e-mail de recuperação agora.",
  "recoverySuccess": "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.",
  "secureKicker": "DESIGN HUB · ACESSO SEGURO",
  "resetTitle": "Crie sua nova senha.",
  "resetIntro": "Use pelo menos 8 caracteres. Depois de salvar, este link não poderá ser usado novamente.",
  "newPassword": "Nova senha",
  "confirmPassword": "Confirme a nova senha",
  "savePassword": "Salvar nova senha",
  "saving": "Salvando…",
  "resetSuccess": "Senha criada com sucesso.",
  "resetSuccessIntro": "Seu link já foi invalidado. Agora você pode entrar usando a nova senha.",
  "goLogin": "Ir para o login",
  "invalidToken": "Este link não contém um código de recuperação válido.",
  "shortPassword": "A nova senha precisa ter pelo menos 8 caracteres.",
  "mismatch": "As duas senhas precisam ser iguais.",
  "resetError": "Não foi possível criar a nova senha.",
  "recoveryUnavailable": "A recuperação de senha ainda não foi configurada.",
  "expiredLink": "Este link é inválido, expirou ou já foi utilizado."
};
export type LoginCopy = Record<keyof typeof portuguese, string>;
export const loginCopy: Record<LoginLocale, LoginCopy> = {
  pt: portuguese,
  en: {
  "kicker": "DESIGN HUB · YOUR CREATIVE SPACE",
  "welcome": "Welcome to your creative space.",
  "intro": "Sign in to follow projects, content and approvals all in one place.",
  "recoveryTitle": "Recover your access.",
  "recoveryIntro": "Enter your email and we’ll send you a temporary link to create a new password.",
  "email": "Email",
  "emailPlaceholder": "Enter your email",
  "password": "Password",
  "passwordPlaceholder": "Enter your password",
  "signIn": "Sign in to Design Hub",
  "forgot": "Forgot my password",
  "back": "Back to sign in",
  "sending": "Sending…",
  "signingIn": "Signing in…",
  "sendLink": "Send secure link",
  "security": "Protected access to your workspace",
  "overview": "Design Hub overview",
  "vision": "THE FULL PICTURE",
  "allInOne": "Everything in one place.",
  "showcase": "Projects, content and decisions organized for a simple, transparent experience.",
  "today": "TODAY",
  "greeting": "Hello, welcome",
  "happening": "Keep up with everything happening",
  "creation": "In progress",
  "approvals": "Approvals",
  "scheduled": "Scheduled",
  "activity": "Recent activity",
  "live": "LIVE",
  "approved": "Content approved",
  "newClient": "New client · just now",
  "newIdea": "New content idea added",
  "team": "Creative team · 8 min",
  "changed": "Changes requested",
  "campaign": "August campaign · 14 min",
  "operational": "All systems operational",
  "language": "Language",
  "loginError": "Could not authenticate with the API or the local fallback.",
  "recoveryError": "Unable to send the recovery email right now.",
  "recoverySuccess": "If this email is registered, you’ll receive a link to create a new password.",
  "secureKicker": "DESIGN HUB · SECURE ACCESS",
  "resetTitle": "Create your new password.",
  "resetIntro": "Use at least 8 characters. Once saved, this link cannot be used again.",
  "newPassword": "New password",
  "confirmPassword": "Confirm new password",
  "savePassword": "Save new password",
  "saving": "Saving…",
  "resetSuccess": "Password created successfully.",
  "resetSuccessIntro": "Your link has been invalidated. You can now sign in with your new password.",
  "goLogin": "Go to sign in",
  "invalidToken": "This link does not contain a valid recovery code.",
  "shortPassword": "Your new password must have at least 8 characters.",
  "mismatch": "Both passwords must match.",
  "resetError": "Unable to create the new password.",
  "recoveryUnavailable": "Password recovery has not been configured yet.",
  "expiredLink": "This link is invalid, expired or has already been used."
},
  it: {
  "kicker": "DESIGN HUB · IL TUO SPAZIO CREATIVO",
  "welcome": "Benvenuto nel tuo spazio creativo.",
  "intro": "Accedi per seguire progetti, contenuti e approvazioni in un unico posto.",
  "recoveryTitle": "Recupera il tuo accesso.",
  "recoveryIntro": "Inserisci la tua email e ti invieremo un link temporaneo per creare una nuova password.",
  "email": "Email",
  "emailPlaceholder": "Inserisci la tua email",
  "password": "Password",
  "passwordPlaceholder": "Inserisci la tua password",
  "signIn": "Accedi a Design Hub",
  "forgot": "Ho dimenticato la password",
  "back": "Torna al login",
  "sending": "Invio in corso…",
  "signingIn": "Accesso in corso…",
  "sendLink": "Invia link sicuro",
  "security": "Accesso protetto al tuo spazio di lavoro",
  "overview": "Panoramica di Design Hub",
  "vision": "UNA VISIONE COMPLETA",
  "allInOne": "Tutto in un unico posto.",
  "showcase": "Progetti, contenuti e decisioni organizzati per un’esperienza semplice e trasparente.",
  "today": "OGGI",
  "greeting": "Ciao, benvenuto",
  "happening": "Segui tutto ciò che sta accadendo",
  "creation": "In creazione",
  "approvals": "Approvazioni",
  "scheduled": "Programmati",
  "activity": "Attività recenti",
  "live": "IN TEMPO REALE",
  "approved": "Contenuto approvato",
  "newClient": "Nuovo cliente · adesso",
  "newIdea": "Nuova idea di contenuto aggiunta",
  "team": "Team creativo · 8 min",
  "changed": "Modifiche richieste",
  "campaign": "Campagna di agosto · 14 min",
  "operational": "Sistema operativo",
  "language": "Lingua",
  "loginError": "Impossibile autenticarsi tramite API o accesso locale di riserva.",
  "recoveryError": "Non è possibile inviare l’email di recupero in questo momento.",
  "recoverySuccess": "Se l’email è registrata, riceverai un link per creare una nuova password.",
  "secureKicker": "DESIGN HUB · ACCESSO SICURO",
  "resetTitle": "Crea la tua nuova password.",
  "resetIntro": "Usa almeno 8 caratteri. Dopo il salvataggio, questo link non potrà essere riutilizzato.",
  "newPassword": "Nuova password",
  "confirmPassword": "Conferma la nuova password",
  "savePassword": "Salva nuova password",
  "saving": "Salvataggio…",
  "resetSuccess": "Password creata con successo.",
  "resetSuccessIntro": "Il link è stato disattivato. Ora puoi accedere con la nuova password.",
  "goLogin": "Vai al login",
  "invalidToken": "Questo link non contiene un codice di recupero valido.",
  "shortPassword": "La nuova password deve contenere almeno 8 caratteri.",
  "mismatch": "Le due password devono coincidere.",
  "resetError": "Non è possibile creare la nuova password.",
  "recoveryUnavailable": "Il recupero della password non è ancora configurato.",
  "expiredLink": "Questo link non è valido, è scaduto o è già stato utilizzato."
},
  es: {
  "kicker": "DESIGN HUB · TU ESPACIO CREATIVO",
  "welcome": "Bienvenido a tu espacio creativo.",
  "intro": "Accede para seguir proyectos, contenidos y aprobaciones en un solo lugar.",
  "recoveryTitle": "Recupera tu acceso.",
  "recoveryIntro": "Introduce tu correo y te enviaremos un enlace temporal para crear una nueva contraseña.",
  "email": "Correo electrónico",
  "emailPlaceholder": "Introduce tu correo electrónico",
  "password": "Contraseña",
  "passwordPlaceholder": "Introduce tu contraseña",
  "signIn": "Entrar en Design Hub",
  "forgot": "Olvidé mi contraseña",
  "back": "Volver al inicio de sesión",
  "sending": "Enviando…",
  "signingIn": "Entrando…",
  "sendLink": "Enviar enlace seguro",
  "security": "Acceso protegido a tu espacio de trabajo",
  "overview": "Vista general de Design Hub",
  "vision": "VISIÓN COMPLETA",
  "allInOne": "Todo en un solo lugar.",
  "showcase": "Proyectos, contenidos y decisiones organizados para una experiencia sencilla y transparente.",
  "today": "HOY",
  "greeting": "Hola, bienvenido",
  "happening": "Sigue todo lo que está pasando",
  "creation": "En creación",
  "approvals": "Aprobaciones",
  "scheduled": "Programados",
  "activity": "Actividad reciente",
  "live": "EN DIRECTO",
  "approved": "Contenido aprobado",
  "newClient": "Nuevo cliente · ahora",
  "newIdea": "Nueva idea de contenido añadida",
  "team": "Equipo creativo · 8 min",
  "changed": "Cambios solicitados",
  "campaign": "Campaña de agosto · 14 min",
  "operational": "Sistema operativo",
  "language": "Idioma",
  "loginError": "No se pudo autenticar mediante la API ni el acceso local alternativo.",
  "recoveryError": "No se puede enviar el correo de recuperación en este momento.",
  "recoverySuccess": "Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.",
  "secureKicker": "DESIGN HUB · ACCESO SEGURO",
  "resetTitle": "Crea tu nueva contraseña.",
  "resetIntro": "Usa al menos 8 caracteres. Después de guardar, este enlace no se podrá reutilizar.",
  "newPassword": "Nueva contraseña",
  "confirmPassword": "Confirma la nueva contraseña",
  "savePassword": "Guardar nueva contraseña",
  "saving": "Guardando…",
  "resetSuccess": "Contraseña creada correctamente.",
  "resetSuccessIntro": "El enlace ya se ha invalidado. Ahora puedes entrar con tu nueva contraseña.",
  "goLogin": "Ir al inicio de sesión",
  "invalidToken": "Este enlace no contiene un código de recuperación válido.",
  "shortPassword": "La nueva contraseña debe tener al menos 8 caracteres.",
  "mismatch": "Las dos contraseñas deben coincidir.",
  "resetError": "No se puede crear la nueva contraseña.",
  "recoveryUnavailable": "La recuperación de contraseña aún no está configurada.",
  "expiredLink": "Este enlace no es válido, ha caducado o ya se ha utilizado."
},
  sv: {
  "kicker": "DESIGN HUB · DIN KREATIVA ARBETSYTA",
  "welcome": "Välkommen till din kreativa arbetsyta.",
  "intro": "Logga in för att följa projekt, innehåll och godkännanden på ett och samma ställe.",
  "recoveryTitle": "Återställ din åtkomst.",
  "recoveryIntro": "Ange din e-postadress så skickar vi en tillfällig länk för att skapa ett nytt lösenord.",
  "email": "E-post",
  "emailPlaceholder": "Ange din e-postadress",
  "password": "Lösenord",
  "passwordPlaceholder": "Ange ditt lösenord",
  "signIn": "Logga in på Design Hub",
  "forgot": "Glömt lösenord",
  "back": "Tillbaka till inloggningen",
  "sending": "Skickar…",
  "signingIn": "Loggar in…",
  "sendLink": "Skicka säker länk",
  "security": "Skyddad åtkomst till din arbetsyta",
  "overview": "Översikt över Design Hub",
  "vision": "FULL ÖVERBLICK",
  "allInOne": "Allt på ett ställe.",
  "showcase": "Projekt, innehåll och beslut samlade för en enkel och tydlig upplevelse.",
  "today": "IDAG",
  "greeting": "Hej och välkommen",
  "happening": "Håll koll på allt som händer",
  "creation": "Under arbete",
  "approvals": "Godkännanden",
  "scheduled": "Schemalagda",
  "activity": "Senaste aktivitet",
  "live": "LIVE",
  "approved": "Innehåll godkänt",
  "newClient": "Ny kund · just nu",
  "newIdea": "Ny innehållsidé tillagd",
  "team": "Kreativa teamet · 8 min",
  "changed": "Ändringar begärda",
  "campaign": "Augustikampanj · 14 min",
  "operational": "Systemet är i drift",
  "language": "Språk",
  "loginError": "Det gick inte att logga in via API eller den lokala reservlösningen.",
  "recoveryError": "Det går inte att skicka återställningsmejlet just nu.",
  "recoverySuccess": "Om e-postadressen är registrerad får du en länk för att skapa ett nytt lösenord.",
  "secureKicker": "DESIGN HUB · SÄKER ÅTKOMST",
  "resetTitle": "Skapa ditt nya lösenord.",
  "resetIntro": "Använd minst 8 tecken. När lösenordet har sparats kan länken inte användas igen.",
  "newPassword": "Nytt lösenord",
  "confirmPassword": "Bekräfta nytt lösenord",
  "savePassword": "Spara nytt lösenord",
  "saving": "Sparar…",
  "resetSuccess": "Lösenordet har skapats.",
  "resetSuccessIntro": "Länken har spärrats. Du kan nu logga in med ditt nya lösenord.",
  "goLogin": "Gå till inloggningen",
  "invalidToken": "Länken innehåller ingen giltig återställningskod.",
  "shortPassword": "Det nya lösenordet måste innehålla minst 8 tecken.",
  "mismatch": "Lösenorden måste vara likadana.",
  "resetError": "Det går inte att skapa det nya lösenordet.",
  "recoveryUnavailable": "Lösenordsåterställning har inte konfigurerats ännu.",
  "expiredLink": "Länken är ogiltig, har gått ut eller har redan använts."
},
};

export function normalizeLoginLocale(value: string | null | undefined): LoginLocale | null {
  const language = value?.trim().toLowerCase().split(/[-_]/)[0];
  return LOGIN_LOCALES.find(locale => locale === language) ?? null;
}

export function detectLoginLocale(): LoginLocale {
  try {
    const manual = normalizeLoginLocale(window.localStorage.getItem(LOGIN_LOCALE_KEY));
    if (manual) return manual;
  } catch { /* Storage may be blocked; browser detection still works. */ }
  if (typeof navigator !== "undefined") {
    for (const language of [...(navigator.languages ?? []), navigator.language]) {
      const locale = normalizeLoginLocale(language);
      if (locale) return locale;
    }
  }
  return "pt";
}

export function useLoginLocale() {
  const [locale, setLocale] = useState<LoginLocale>(detectLoginLocale);
  function chooseLocale(next: LoginLocale) {
    setLocale(next);
    try { window.localStorage.setItem(LOGIN_LOCALE_KEY, next); } catch { /* Keep the choice in memory. */ }
  }
  return { locale, chooseLocale, copy: loginCopy[locale] };
}

export function useLoginIntro(enabled: boolean) {
  const [playIntro] = useState(() => {
    if (!enabled || typeof window === "undefined") return false;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
    try { return window.sessionStorage.getItem(LOGIN_INTRO_KEY) !== "1"; } catch { return false; }
  });
  useEffect(() => {
    if (enabled) {
      try { window.sessionStorage.setItem(LOGIN_INTRO_KEY, "1"); } catch { /* Login never depends on storage. */ }
    }
  }, [enabled]);
  return playIntro;
}

// Translate the existing public API messages without changing the API or its behavior.
export function publicAuthMessage(message: string, copy: LoginCopy): string {
  const key = (Object.keys(portuguese) as Array<keyof LoginCopy>).find(key => portuguese[key] === message);
  return key ? copy[key] : message;
}
