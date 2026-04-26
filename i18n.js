import { I18n } from 'i18n-js';
import tr from './locales/tr';
import en from './locales/en';

const i18n = new I18n({
  tr,
  en,
});

i18n.defaultLocale = 'tr';
i18n.locale = 'tr';
i18n.enableFallback = true;

export default i18n;