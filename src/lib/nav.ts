import { useTranslation } from 'react-i18next';

/* Pages du menu principal (en-tête, menu mobile et satellites en orbite de l'accueil) */
export const useNavItems = () => {
  const { t } = useTranslation();
  return [
    { path: '/', label: t('nav.home') },
    { path: '/projects', label: t('nav.projects') },
    { path: '/about', label: t('nav.about') },
    { path: '/contact', label: t('nav.contact') },
    { path: '/chatbot', label: t('nav.chatbot') },
  ];
};
