import * as React from "react";

export interface CountryInfo {
  name: string;
  code: string;
  alpha3: string;
  languageCode: string;
  languageName: string;
}

export function getCountryDetails(input?: string | null): {
  name: string;
  code: string;
  alpha3: string;
  languageCode: string;
  languageName: string;
  flag: React.ReactNode;
} {
  const clean = (input || "").trim().toLowerCase();

  // Itália
  if (/ital/i.test(clean) || clean === "it" || clean === "ita") {
    return {
      name: input && input.trim().length > 0 ? input.trim() : "Itália",
      code: "IT",
      alpha3: "ITA",
      languageCode: "IT / ITA",
      languageName: "Italiano",
      flag: (
        <svg viewBox="0 0 3 2" className="w-4 h-3 rounded-xs overflow-hidden border border-stone-200 flex-shrink-0 shadow-2xs">
          <rect width="1" height="2" fill="#009246" />
          <rect x="1" width="1" height="2" fill="#ffffff" />
          <rect x="2" width="1" height="2" fill="#ce2b37" />
        </svg>
      ),
    };
  }

  // França
  if (/fran/i.test(clean) || clean === "fr" || clean === "fra") {
    return {
      name: input && input.trim().length > 0 ? input.trim() : "França",
      code: "FR",
      alpha3: "FRA",
      languageCode: "FR / FRA",
      languageName: "Francês",
      flag: (
        <svg viewBox="0 0 3 2" className="w-4 h-3 rounded-xs overflow-hidden border border-stone-200 flex-shrink-0 shadow-2xs">
          <rect width="1" height="2" fill="#002395" />
          <rect x="1" width="1" height="2" fill="#ffffff" />
          <rect x="2" width="1" height="2" fill="#ED2939" />
        </svg>
      ),
    };
  }

  // Espanha
  if (/espan|spain/i.test(clean) || clean === "es" || clean === "esp") {
    return {
      name: input && input.trim().length > 0 ? input.trim() : "Espanha",
      code: "ES",
      alpha3: "ESP",
      languageCode: "ES / ESP",
      languageName: "Espanhol",
      flag: (
        <svg viewBox="0 0 3 2" className="w-4 h-3 rounded-xs overflow-hidden border border-stone-200 flex-shrink-0 shadow-2xs">
          <rect width="3" height="0.5" fill="#AA151B" />
          <rect y="0.5" width="3" height="1" fill="#F1BF00" />
          <rect y="1.5" width="3" height="0.5" fill="#AA151B" />
        </svg>
      ),
    };
  }

  // Argentina
  if (/argentin/i.test(clean) || clean === "ar" || clean === "arg") {
    return {
      name: input && input.trim().length > 0 ? input.trim() : "Argentina",
      code: "AR",
      alpha3: "ARG",
      languageCode: "ES / ARG",
      languageName: "Espanhol",
      flag: (
        <svg viewBox="0 0 3 2" className="w-4 h-3 rounded-xs overflow-hidden border border-stone-200 flex-shrink-0 shadow-2xs">
          <rect width="3" height="0.66" fill="#74ACDF" />
          <rect y="0.66" width="3" height="0.68" fill="#ffffff" />
          <rect y="1.34" width="3" height="0.66" fill="#74ACDF" />
          <circle cx="1.5" cy="1" r="0.2" fill="#F6B40E" />
        </svg>
      ),
    };
  }

  // Chile
  if (/chile/i.test(clean) || clean === "cl" || clean === "chl") {
    return {
      name: input && input.trim().length > 0 ? input.trim() : "Chile",
      code: "CL",
      alpha3: "CHL",
      languageCode: "ES / CHL",
      languageName: "Espanhol",
      flag: (
        <svg viewBox="0 0 3 2" className="w-4 h-3 rounded-xs overflow-hidden border border-stone-200 flex-shrink-0 shadow-2xs">
          <rect width="3" height="1" fill="#ffffff" />
          <rect y="1" width="3" height="1" fill="#D52B1E" />
          <rect width="1" height="1" fill="#0039A6" />
          <polygon points="0.5,0.2 0.58,0.45 0.85,0.45 0.63,0.6 0.72,0.85 0.5,0.7 0.28,0.85 0.37,0.6 0.15,0.45 0.42,0.45" fill="#ffffff" />
        </svg>
      ),
    };
  }

  // Uruguai
  if (/urugua/i.test(clean) || clean === "uy" || clean === "ury") {
    return {
      name: input && input.trim().length > 0 ? input.trim() : "Uruguai",
      code: "UY",
      alpha3: "URY",
      languageCode: "ES / URY",
      languageName: "Espanhol",
      flag: (
        <svg viewBox="0 0 3 2" className="w-4 h-3 rounded-xs overflow-hidden border border-stone-200 flex-shrink-0 shadow-2xs">
          <rect width="3" height="2" fill="#ffffff" />
          <rect y="0.22" width="3" height="0.22" fill="#0038A8" />
          <rect y="0.66" width="3" height="0.22" fill="#0038A8" />
          <rect y="1.11" width="3" height="0.22" fill="#0038A8" />
          <rect y="1.55" width="3" height="0.22" fill="#0038A8" />
          <rect width="1.1" height="0.9" fill="#ffffff" />
          <circle cx="0.55" cy="0.45" r="0.25" fill="#FCD116" />
        </svg>
      ),
    };
  }

  // Estados Unidos
  if (/estados unidos|united states|usa|eua/i.test(clean) || clean === "us") {
    return {
      name: input && input.trim().length > 0 ? input.trim() : "Estados Unidos",
      code: "US",
      alpha3: "USA",
      languageCode: "EN / USA",
      languageName: "Inglês",
      flag: (
        <svg viewBox="0 0 3 2" className="w-4 h-3 rounded-xs overflow-hidden border border-stone-200 flex-shrink-0 shadow-2xs">
          <rect width="3" height="2" fill="#B22234" />
          <rect y="0.28" width="3" height="0.28" fill="#ffffff" />
          <rect y="0.84" width="3" height="0.28" fill="#ffffff" />
          <rect y="1.4" width="3" height="0.28" fill="#ffffff" />
          <rect width="1.2" height="1.1" fill="#3C3B6E" />
        </svg>
      ),
    };
  }

  // Alemanha
  if (/alemanha|germany|deutsch/i.test(clean) || clean === "de" || clean === "deu") {
    return {
      name: input && input.trim().length > 0 ? input.trim() : "Alemanha",
      code: "DE",
      alpha3: "DEU",
      languageCode: "DE / DEU",
      languageName: "Alemão",
      flag: (
        <svg viewBox="0 0 3 2" className="w-4 h-3 rounded-xs overflow-hidden border border-stone-200 flex-shrink-0 shadow-2xs">
          <rect width="3" height="0.67" fill="#000000" />
          <rect y="0.67" width="3" height="0.67" fill="#DD0000" />
          <rect y="1.33" width="3" height="0.67" fill="#FFCE00" />
        </svg>
      ),
    };
  }

  // África do Sul
  if (/africa do sul|áfrica do sul|south africa/i.test(clean) || clean === "za" || clean === "zaf") {
    return {
      name: input && input.trim().length > 0 ? input.trim() : "África do Sul",
      code: "ZA",
      alpha3: "ZAF",
      languageCode: "EN / ZAF",
      languageName: "Inglês",
      flag: (
        <svg viewBox="0 0 3 2" className="w-4 h-3 rounded-xs overflow-hidden border border-stone-200 flex-shrink-0 shadow-2xs">
          <rect width="3" height="1" fill="#E03C31" />
          <rect y="1" width="3" height="1" fill="#001489" />
          <polygon points="0,0 1.2,1 0,2" fill="#000000" />
          <polygon points="0,0 1.5,1 0,2" stroke="#007749" strokeWidth="0.4" fill="none" />
        </svg>
      ),
    };
  }

  // Brasil
  if (/brasil|brazil/i.test(clean) || clean === "br" || clean === "bra") {
    return {
      name: input && input.trim().length > 0 ? input.trim() : "Brasil",
      code: "BR",
      alpha3: "BRA",
      languageCode: "PT / BRA",
      languageName: "Português",
      flag: (
        <svg viewBox="0 0 3 2" className="w-4 h-3 rounded-xs overflow-hidden border border-stone-200 flex-shrink-0 shadow-2xs">
          <rect width="3" height="2" fill="#009B3A" />
          <polygon points="1.5,0.25 2.75,1 1.5,1.75 0.25,1" fill="#FEDF01" />
          <circle cx="1.5" cy="1" r="0.42" fill="#002776" />
        </svg>
      ),
    };
  }

  // Portugal (Default para vinhos da base ou caso identificado)
  return {
    name: input && input.trim().length > 0 ? input.trim() : "Portugal",
    code: "PT",
    alpha3: "PRT",
    languageCode: "PT / PRT",
    languageName: "Português",
    flag: (
      <svg viewBox="0 0 3 2" className="w-4 h-3 rounded-xs overflow-hidden border border-stone-200 flex-shrink-0 shadow-2xs">
        <rect width="1.2" height="2" fill="#046A38" />
        <rect x="1.2" width="1.8" height="2" fill="#DA291C" />
        <circle cx="1.2" cy="1" r="0.35" fill="#FFC400" />
      </svg>
    ),
  };
}

export function CountryOriginBadge({
  country,
  className = "",
  showLanguage = true,
  textClassName = "text-xs font-semibold text-stone-800",
}: {
  country?: string | null;
  className?: string;
  showLanguage?: boolean;
  textClassName?: string;
}) {
  const details = getCountryDetails(country);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {details.flag}
      <p className={textClassName}>{details.name}</p>
      {showLanguage && (
        <span className="text-[10px] text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded font-medium tracking-wide">
          {details.languageCode}
        </span>
      )}
    </div>
  );
}
