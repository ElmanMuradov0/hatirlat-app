import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import i18n from '../i18n';
import { useDil } from '../LanguageContext';
import { useAlert } from '../components/AlertProvider';
import { getLocalizedErrorMessage } from '../lib/errorMessages';
import { getAuthCallbackError, getCallbackLocale } from '../lib/authDeepLink';
import { getLatestDeepLink } from '../lib/deepLinkStore';

export default function AuthConfirmScreen({ navigation }) {
  const handledRef = useRef(false);
  const [url, setUrl] = useState(null);
  const { dilDegistir } = useDil();
  const { showAlert } = useAlert();
  const t = (key, config) => i18n.t(key, config);

  useEffect(() => {
    let mounted = true;

    const loadUrl = async () => {
      const initialUrl = getLatestDeepLink() || await Linking.getInitialURL();
      if (mounted && initialUrl) {
        setUrl(initialUrl);
      }
    };

    loadUrl();

    const subscription = Linking.addEventListener('url', ({ url: nextUrl }) => {
      if (nextUrl) {
        setUrl(nextUrl);
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (url || handledRef.current) {
      return;
    }

    const timeout = setTimeout(() => {
      showAlert({
        type: 'error',
        title: t('hata'),
        message: t('gecersizYenilemeBaglantisi'),
        actions: [
          {
            label: t('tamam'),
            variant: 'primary',
            onPress: () => navigation.replace('Login'),
          },
        ],
      });
    }, 3500);

    return () => clearTimeout(timeout);
  }, [navigation, showAlert, t, url]);

  useEffect(() => {
    if (!url || handledRef.current) {
      return;
    }

    handledRef.current = true;

    const activeLocale = getCallbackLocale(url);
    dilDegistir(activeLocale);

    const callbackError = getAuthCallbackError(url);
    if (callbackError) {
      showAlert({
        type: 'error',
        title: t('hata'),
        message: getLocalizedErrorMessage({ message: callbackError }, t),
        actions: [
          {
            label: t('tamam'),
            variant: 'primary',
            onPress: () => navigation.replace('Login'),
          },
        ],
      });
      return;
    }

    showAlert({
      type: 'success',
      title: t('basarili'),
      message: t('emailDogrulandiMesaj'),
      actions: [
        {
          label: t('girisYap'),
          variant: 'primary',
          onPress: () => navigation.replace('Login'),
        },
      ],
    });
  }, [dilDegistir, navigation, showAlert, t, url]);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar style="dark" />
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.text}>{t('baglantiDogrulaniyor')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FC',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  text: {
    marginTop: 14,
    fontSize: 15,
    color: '#51627E',
    textAlign: 'center',
  },
});
