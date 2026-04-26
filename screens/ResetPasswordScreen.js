import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../i18n';
import { useDil } from '../LanguageContext';
import { useAlert } from '../components/AlertProvider';
import { supabase } from '../lib/supabase';
import { establishSessionFromUrl, getCallbackLocale, getAuthCallbackError } from '../lib/authDeepLink';
import { getLocalizedErrorMessage } from '../lib/errorMessages';
import { getLatestDeepLink } from '../lib/deepLinkStore';

export default function ResetPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const handledRef = useRef(false);
  const [url, setUrl] = useState(null);
  const { dilDegistir } = useDil();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    if (!loading || url) {
      return;
    }

    const timeout = setTimeout(() => {
      setLoading(false);
      showAlert({
        type: 'error',
        title: t('hata'),
        message: t('gecersizYenilemeBaglantisi'),
        actions: [
          {
            label: t('tamam'),
            variant: 'primary',
            onPress: async () => {
              await supabase.auth.signOut();
              navigation.replace('Login');
            },
          },
        ],
      });
    }, 3500);

    return () => clearTimeout(timeout);
  }, [loading, navigation, showAlert, t, url]);

  useEffect(() => {
    if (!url || handledRef.current) {
      return;
    }

    handledRef.current = true;

    const prepare = async () => {
      try {
        const activeLocale = getCallbackLocale(url);
        dilDegistir(activeLocale);

        const callbackError = getAuthCallbackError(url);
        if (callbackError) {
          throw new Error(callbackError);
        }

        await establishSessionFromUrl(url);
      } catch (error) {
        showAlert({
          type: 'error',
          title: t('hata'),
          message: getLocalizedErrorMessage(error, t),
          actions: [
            {
              label: t('tamam'),
              variant: 'primary',
              onPress: async () => {
                await supabase.auth.signOut();
                setTimeout(() => navigation.replace('Login'), 150);
              },
            },
          ],
        });
      } finally {
        setLoading(false);
      }
    };

    prepare();
  }, [dilDegistir, navigation, showAlert, t, url]);

  const returnToLogin = async () => {
    await supabase.auth.signOut();
    setTimeout(() => navigation.replace('Login'), 150);
  };

  const handleSavePassword = async () => {
    if (!password || !confirmPassword) {
      showAlert({
        type: 'warning',
        title: t('eksikBilgi'),
        message: t('gerekliAlanlariDoldur'),
      });
      return;
    }

    if (password !== confirmPassword) {
      showAlert({
        type: 'warning',
        title: t('hata'),
        message: t('sifrelerEslesmiyor'),
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      showAlert({
        type: 'success',
        title: t('basarili'),
        message: t('sifreGuncellendiMesaj'),
        actions: [
          {
            label: t('girisYap'),
            variant: 'primary',
            onPress: returnToLogin,
          },
        ],
      });
    } catch (error) {
      showAlert({
        type: 'error',
        title: t('hata'),
        message: getLocalizedErrorMessage(error, t),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.helperText}>{t('baglantiDogrulaniyor')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[
          styles.inner,
          {
            paddingTop: Platform.OS === 'android' ? insets.top + 24 : insets.top + 12,
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        <View style={styles.logoCircle}>
          <Ionicons name="lock-closed-outline" size={28} color="#fff" />
        </View>
        <Text style={styles.title}>{t('resetPassword')}</Text>
        <Text style={styles.subtitle}>{t('sifreYenileHazir')}</Text>

        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#93A3BF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('yeniSifre')}
              placeholderTextColor="#93A3BF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#93A3BF" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#93A3BF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('yeniSifreTekrar')}
              placeholderTextColor="#93A3BF"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword((prev) => !prev)}>
              <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#93A3BF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, saving && { opacity: 0.7 }]}
            onPress={handleSavePassword}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('sifreyiKaydet')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#93A3BF',
    textAlign: 'center',
  },
  helperText: {
    marginTop: 14,
    fontSize: 15,
    color: '#93A3BF',
    textAlign: 'center',
  },
  form: {
    marginTop: 28,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#182236',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2B3A57',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#ffffff',
    paddingVertical: 14,
  },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
