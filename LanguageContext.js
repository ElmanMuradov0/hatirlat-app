import { createContext, useContext, useState } from 'react';
import i18n from './i18n';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [dil, setDil] = useState('tr');

  const dilDegistir = (kod) => {
    i18n.locale = kod;
    setDil(kod);
  };

  return (
    <LanguageContext.Provider value={{ dil, dilDegistir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useDil() {
  return useContext(LanguageContext);
}