import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import zh from '../locales/zh.json';
import ja from '../locales/ja.json';
import ko from '../locales/ko.json';
import ar from '../locales/ar.json';
import hi from '../locales/hi.json';
import bn from '../locales/bn.json';
import ru from '../locales/ru.json';
import pt from '../locales/pt.json';
import id from '../locales/id.json';
import fil from '../locales/fil.json';
import vi from '../locales/vi.json';

const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    zh: { translation: zh },
    ja: { translation: ja },
    ko: { translation: ko },
    ar: { translation: ar },
    hi: { translation: hi },
    bn: { translation: bn },
    ru: { translation: ru },
    pt: { translation: pt },
    id: { translation: id },
    fil: { translation: fil },
    vi: { translation: vi },
  },
  lng: deviceLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v3',
});

export default i18n;
