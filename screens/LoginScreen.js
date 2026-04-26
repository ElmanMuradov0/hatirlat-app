import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Modal, ActivityIndicator, TouchableWithoutFeedback, Pressable } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../i18n';
import { useDil } from '../LanguageContext';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase'; // Supabase bağlantısını ekledik
import { useAlert } from '../components/AlertProvider';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLocalizedErrorMessage } from '../lib/errorMessages';

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { dil, dilDegistir } = useDil();
  const { showAlert } = useAlert();
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [sifreGoster, setSifreGoster] = useState(false);
  const [dilModal, setDilModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotModal, setForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotValidation, setForgotValidation] = useState('');

  const diller = [
    { kod: 'tr', ad: 'Türkçe', bayrak: '🇹🇷' },
    { kod: 'en', ad: 'English', bayrak: '🇬🇧' },
  ];

  const closeForgotModal = () => {
    setForgotModal(false);
    setForgotEmail('');
    setForgotLoading(false);
    setForgotValidation('');
  };

  const dilDegistir2 = (kod) => {
    dilDegistir(kod);
    setDilModal(false);
  };

  const t = (key, config) => i18n.t(key, config);
  const getErrorMessage = (error, fallbackKey = 'islemTamamlanamadi') =>
    getLocalizedErrorMessage(error, t, fallbackKey);

  // Giriş Yapma Fonksiyonu
  const handleLogin = async () => {
    if (!email || !sifre) {
      showAlert({
        type: 'warning',
        title: t('eksikBilgi'),
        message: t('epostaSifreGir'),
      });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: sifre,
    });

    setLoading(false);

    if (error) {
      showAlert({
        type: 'error',
        title: t('girisHatasi'),
        message: getErrorMessage(error),
      });
      return;
    }

    if (data?.user) {
      const activeLocale = i18n.locale === 'en' ? 'en' : 'tr';
      supabase.auth
        .updateUser({
          data: { language: activeLocale },
        })
        .catch((updateError) => {
          console.log('Dil metadata guncellenemedi:', updateError?.message || updateError);
        });
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = forgotEmail.trim();

    if (!trimmedEmail) {
      setForgotValidation(t('enterEmail'));
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      setForgotValidation(t('gecersizEposta'));
      return;
    }

    setForgotValidation('');
    setForgotLoading(true);
    try {
      const activeLocale = i18n.locale === 'en' ? 'en' : 'tr';
      const resetRedirect =
        activeLocale === 'en'
          ? 'pingy://auth/reset-password?lang=en'
          : 'pingy://auth/reset-password?lang=tr';

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: resetRedirect,
      });

      if (error) {
        throw error;
      }

      showAlert({
        type: 'success',
        title: t('resetPassword'),
        message: t('resetLinkSent', { email: trimmedEmail }),
      });
      closeForgotModal();
    } catch (error) {
      setForgotModal(false);
      showAlert({
        type: 'error',
        title: t('hata'),
        message: getErrorMessage(error),
      });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <>
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[
          styles.inner,
          {
            paddingTop: Platform.OS === 'android' ? insets.top + 24 : insets.top + 8,
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >

        {/* Dil Seçici */}
        <TouchableOpacity style={styles.dilButon} onPress={() => setDilModal(true)}>
          <Ionicons name="globe-outline" size={16} color="#fff" />
          <Text style={styles.dilText}>{dil === 'tr' ? '🇹🇷 TR' : '🇬🇧 EN'}</Text>
          <Ionicons name="chevron-down" size={14} color="#93A3BF" />
        </TouchableOpacity>

        {/* Dil Modal */}
        <Modal visible={dilModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setDilModal(false)}>
            <View style={styles.modalKutu}>
              {diller.map((d) => (
                <TouchableOpacity
                  key={d.kod}
                  style={[styles.dilSecenegi, dil === d.kod && styles.dilSecenek_aktif]}
                  onPress={() => dilDegistir2(d.kod)}
                >
                  <Text style={styles.dilBayrak}>{d.bayrak}</Text>
                  <Text style={styles.dilAd}>{d.ad}</Text>
                  {dil === d.kod && <Ionicons name="checkmark" size={16} color="#6C63FF" style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Logo & Başlık */}
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="notifications" size={32} color="#fff" />
          </View>
          <Text style={styles.appAdi}>Pingy</Text>
          <Text style={styles.slogan}>{t('slogan')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#93A3BF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('epostaAdresi')}
              placeholderTextColor="#93A3BF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#93A3BF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('sifre')}
              placeholderTextColor="#93A3BF"
              value={sifre}
              onChangeText={setSifre}
              secureTextEntry={!sifreGoster}
            />
            <TouchableOpacity onPress={() => setSifreGoster(!sifreGoster)}>
              <Ionicons name={sifreGoster ? "eye-outline" : "eye-off-outline"} size={18} color="#93A3BF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.buton, loading && { opacity: 0.7 }]} 
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.butonText}>
              {loading ? t('girisYapiliyor') : t('girisYap')}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </View>

        {/* Alt link */}
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>
              {t('hesabinYokMu')} <Text style={styles.linkVurgu}>{t('kayitOl')}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotLink} onPress={() => setForgotModal(true)}>
            <Text style={styles.forgotLinkText}>{t('forgotPassword')}</Text>
          </TouchableOpacity>

        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={forgotModal}
        transparent
        animationType="fade"
        onRequestClose={closeForgotModal}
      >
        <View style={styles.forgotModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeForgotModal} />
          <TouchableWithoutFeedback>
            <View style={styles.forgotModalContent}>
              <Text style={styles.forgotTitle}>{t('resetPassword')}</Text>
              <Text style={styles.forgotDescription}>{t('forgotPasswordDescription')}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color="#93A3BF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('epostaAdresi')}
                  placeholderTextColor="#93A3BF"
                  value={forgotEmail}
                  onChangeText={(value) => {
                    setForgotEmail(value);
                    if (forgotValidation) {
                      setForgotValidation('');
                    }
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {!!forgotValidation && (
                <Text style={styles.forgotValidationText}>{forgotValidation}</Text>
              )}
              <TouchableOpacity
                style={[styles.buton, forgotLoading && { opacity: 0.6, backgroundColor: '#5B6991' }]}
                onPress={handleForgotPassword}
                disabled={forgotLoading}
              >
                {forgotLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.butonText}>{t('sendResetLink')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>
    </>
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
  dilButon: {
    position: 'absolute',
    top: 60,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#182236',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2B3A57',
  },
  dilText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: 24,
  },
  modalKutu: {
    backgroundColor: '#182236',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2B3A57',
    minWidth: 160,
  },
  dilSecenegi: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  dilSecenek_aktif: {
    backgroundColor: '#2B3A57',
  },
  dilBayrak: {
    fontSize: 18,
  },
  dilAd: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  appAdi: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  slogan: {
    fontSize: 14,
    color: '#93A3BF',
    marginTop: 4,
  },
  form: {
    marginBottom: 24,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#182236',
    borderRadius: 14,
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
  buton: {
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  butonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  ayirac: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  cizgi: {
    flex: 1,
    height: 1,
    backgroundColor: '#2B3A57',
  },
  ayiracText: {
    marginHorizontal: 12,
    color: '#93A3BF',
    fontSize: 13,
  },
  googleButon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#182236',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#2B3A57',
  },
  googleButonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
  },
  linkText: {
    textAlign: 'center',
    color: '#93A3BF',
    fontSize: 14,
  },
  linkVurgu: {
    color: '#7C9CFF',
    fontWeight: '600',
  },
  forgotLink: {
    alignSelf: 'center',
    marginTop: 12,
  },
  forgotLinkText: {
    color: '#7C9CFF',
    fontSize: 14,
    fontWeight: '500',
  },
  forgotModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 16, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  forgotModalContent: {
    backgroundColor: '#182236',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2B3A57',
  },
  forgotTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  forgotDescription: {
    fontSize: 14,
    color: '#C9D4E7',
    marginBottom: 12,
    lineHeight: 20,
  },
  forgotValidationText: {
    color: '#F28B82',
    fontSize: 13,
    marginTop: -2,
    marginBottom: 8,
  },
});
