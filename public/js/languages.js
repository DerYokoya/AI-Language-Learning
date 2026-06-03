export const langMap = {
  Spanish: "es-ES",
  French: "fr-FR",
  German: "de-DE",
  Italian: "it-IT",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  "Mandarin Chinese": "zh-CN",
  English: "en-US",
  Portuguese: "pt-BR",
  Arabic: "ar-SA",
  Hindi: "hi-IN",
};

// Derived helpers so nothing else needs to re-compute these
export const languageNames = Object.keys(langMap);
export const languageCodes = Object.values(langMap);