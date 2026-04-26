import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useDil } from '../LanguageContext';
import i18n from '../i18n';
import { supabase } from '../lib/supabase';
import { useAlert } from '../components/AlertProvider';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLocalizedErrorMessage } from '../lib/errorMessages';

export default function RegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { dil } = useDil();
  const t = (key) => i18n.t(key);
  const { showAlert } = useAlert();
  const getErrorMessage = (error, fallbackKey = 'islemTamamlanamadi') =>
    getLocalizedErrorMessage(error, t, fallbackKey);

  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [sifreGoster, setSifreGoster] = useState(false);
  const [loading, setLoading] = useState(false);

  // Supabase Kayıt Fonksiyonu
  const handleSignUp = async () => {
    if (!email || !sifre || !ad) {
      showAlert({
        type: 'warning',
        title: t('eksikBilgi'),
        message: t('gerekliAlanlariDoldur'),
      });
      return;
    }

    if (sifre !== sifreTekrar) {
      showAlert({
        type: 'warning',
        title: t('hata'),
        message: t('sifrelerEslesmiyor'),
      });
      return;
    }

    setLoading(true);
    const emailRedirectTo =
      dil === 'en'
        ? 'pingy://auth/confirm?lang=en'
        : 'pingy://auth/confirm?lang=tr';

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: sifre,
      options: {
        emailRedirectTo,
        data: {
          first_name: ad,
          last_name: soyad,
          language: dil,
        },
      },
    });

    setLoading(false);

    if (error) {
      showAlert({
        type: 'error',
        title: t('kayitHatasi'),
        message: getErrorMessage(error),
      });
    } else {
      showAlert({
        type: 'success',
        title: t('kayitBasarili'),
        message: t('kayitMailKontrol'),
        actions: [
          {
            label: t('girisYap'),
            variant: 'primary',
            onPress: () => navigation.navigate('Login'),
          },
        ],
      });
    }
  };

  return (
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

        <TouchableOpacity style={styles.geri} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.baslikWrap}>
          <Text style={styles.baslik}>{t('hesapOlustur')}</Text>
          <Text style={styles.altBaslik}>{t('katil')}</Text>
        </View>

        <View style={styles.form}>

          <View style={styles.ikiliSatir}>
            <View style={[styles.inputWrap, { flex: 1 }]}>
              <Ionicons name="person-outline" size={18} color="#93A3BF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('ad')}
                placeholderTextColor="#93A3BF"
                value={ad}
                onChangeText={setAd}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.inputWrap, { flex: 1 }]}>
              <TextInput
                style={styles.input}
                placeholder={t('soyad')}
                placeholderTextColor="#93A3BF"
                value={soyad}
                onChangeText={setSoyad}
                autoCapitalize="words"
              />
            </View>
          </View>

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

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#93A3BF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('sifreTekrar')}
              placeholderTextColor="#93A3BF"
              value={sifreTekrar}
              onChangeText={setSifreTekrar}
              secureTextEntry={!sifreGoster}
            />
          </View>

          <TouchableOpacity
            style={[styles.buton, loading && { opacity: 0.7 }]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={styles.butonText}>
              {loading ? t('bekleyin') : t('kayitOl')}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>
            {t('hesabinVarMi')} <Text style={styles.linkVurgu}>{t('girisYap')}</Text>
          </Text>
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  geri: {
    position: 'absolute', top: 20, left: 0,
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#182236', alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, borderColor: '#2B3A57',
  },
  baslikWrap: { marginBottom: 36 },
  baslik: { fontSize: 28, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5 },
  altBaslik: { fontSize: 14, color: '#93A3BF', marginTop: 6 },
  form: { marginBottom: 24 },
  ikiliSatir: { flexDirection: 'row', gap: 10 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#182236', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 4,
    marginBottom: 12, borderWidth: 1, borderColor: '#2B3A57',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#ffffff', paddingVertical: 14 },
  buton: {
    backgroundColor: '#6C63FF', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 8,
  },
  butonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkText: { textAlign: 'center', color: '#93A3BF', fontSize: 14 },
  linkVurgu: { color: '#7C9CFF', fontWeight: '600' },
});
