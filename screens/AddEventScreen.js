import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'; 
import * as Notifications from 'expo-notifications';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import i18n from '../i18n';
import { useDil } from '../LanguageContext';
import { calculateRemainingCredits, ensureProfile } from '../lib/profile';
import { syncPremiumStatus } from '../lib/premiumSync';
import { useAlert } from '../components/AlertProvider';
import { getLocalizedErrorMessage } from '../lib/errorMessages';

const KATEGORILER = [
  { value: 'Sağlık', key: 'saglik', ikon: 'fitness-outline', renk: '#F28B82' },
  { value: 'Ders', key: 'ders', ikon: 'book-outline', renk: '#7C9CFF' },
  { value: 'İş', key: 'is', ikon: 'briefcase-outline', renk: '#72C9A3' },
  { value: 'Genel', key: 'genel', ikon: 'apps-outline', renk: '#F2C66D' },
];

const BILDIRIMLER = [
  { key: 'birGunOnce', value: '1440', premium: true },
  { key: 'altiSaatOnce', value: '360', premium: true },
  { key: 'ucSaatOnce', value: '180', premium: false },
  { key: 'birSaatOnce', value: '60', premium: false },
];

const formatLocalDate = (value) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatLocalTime = (value) => {
  const hours = `${value.getHours()}`.padStart(2, '0');
  const minutes = `${value.getMinutes()}`.padStart(2, '0');
  const seconds = `${value.getSeconds()}`.padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

export default function AddEventScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const editEvent = route.params?.event;
  
  const [baslik, setBaslik] = useState('');
  const [kategori, setKategori] = useState('Genel');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [mode, setMode] = useState('date');
  const [bildirimler, setBildirimler] = useState(['60']);
  const [loading, setLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const { dil } = useDil();
  const { showAlert } = useAlert();
  const t = (key) => i18n.t(key);
  const locale = dil === 'en' ? 'en-GB' : 'tr-TR';
  const getErrorMessage = (error, fallbackKey = 'islemTamamlanamadi') =>
    getLocalizedErrorMessage(error, t, fallbackKey);
  const premiumLocked = profileLoaded && !isPremium;

  const handleKategoriSecimi = (value) => {
    if (premiumLocked && value !== 'Genel') {
      showAlert({
        type: 'warning',
        title: t('premium'),
        message: t('genelKategoriPremium'),
        actions: [
          { label: t('tamam'), onPress: () => navigation.navigate('Credits') },
        ],
      });
      return;
    }
    setKategori(value);
  };

  const handleBildirimToggle = (value, requiresPremium) => {
    if (requiresPremium && premiumLocked) {
      showAlert({
        type: 'warning',
        title: t('premium'),
        message: t('premiumReminderRequired'),
        actions: [
          { label: t('tamam'), onPress: () => navigation.navigate('Credits') },
        ],
      });
      return;
    }
    if (bildirimler.includes(value)) {
      setBildirimler(bildirimler.filter((item) => item !== value));
    } else {
      setBildirimler([...bildirimler, value]);
    }
  };

  useEffect(() => {
    if (editEvent) {
      setBaslik(editEvent.title);
      setKategori(editEvent.category);
      setBildirimler(editEvent.notification_settings || []);
      const fullDate = new Date(`${editEvent.event_date}T${editEvent.event_time}`);
      if (!isNaN(fullDate)) setDate(fullDate);
    }
  }, [editEvent]);

  const onChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  const openPicker = (pickerMode) => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: pickerMode,
        is24Hour: true,
        onChange,
      });
      return;
    }

    setMode(pickerMode);
    setShowPicker(true);
  };

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) setProfileLoaded(true);
        return;
      }
      let premiumEnabled = false;
      try {
        premiumEnabled = await syncPremiumStatus(user.id);
      } catch (premiumSyncError) {
        console.log('Premium durumu senkronlanamadi:', premiumSyncError?.message || premiumSyncError);
      }
      const profile = await ensureProfile(user.id);
      if (mounted) {
        setIsPremium(premiumEnabled || !!profile.is_premium);
        setProfileLoaded(true);
      }
    };
    loadProfile();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (editEvent && profileLoaded && !isPremium) {
      showAlert({
        type: 'warning',
        title: i18n.t('premium'),
        message: i18n.t('premiumNeededForEdit'),
        actions: [
          { label: i18n.t('tamam'), onPress: () => navigation.navigate('Credits') },
        ],
      });
    }
  }, [editEvent, profileLoaded, isPremium, navigation, showAlert]);

  const kaydet = async () => {
    if (!baslik.trim()) {
      showAlert({ type: 'warning', title: t('hata'), message: t('etkinlikAdiGir') });
      return;
    }

    const eventTimestamp = date.getTime();
    const now = Date.now();

    if (eventTimestamp <= now + 60000) {
      showAlert({ type: 'warning', title: t('hata'), message: t('etkinlikGelecek') });
      return;
    }

    const eventDiffMs = eventTimestamp - now;
      const reminderMinutes = bildirimler
        .map((value) => parseInt(value, 10))
        .filter((minutes) => !Number.isNaN(minutes) && minutes > 0);

    if (reminderMinutes.some((minutes) => eventDiffMs <= minutes * 60000)) {
      showAlert({ type: 'warning', title: t('hata'), message: t('hatirlatmaYetersiz') });
      return;
    }

    setLoading(true);
    let yeniBildirimIdleri = [];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('oturumBulunamadi'));

      const profile = await ensureProfile(user.id);
      const premiumUser = !!profile.is_premium;

      if (!premiumUser && kategori !== 'Genel') {
        showAlert({
          type: 'warning',
          title: t('premium'),
          message: t('genelKategoriPremium'),
          actions: [
            { label: t('tamam'), onPress: () => navigation.navigate('Credits') },
          ],
        });
        setLoading(false);
        return;
      }

      if (!editEvent && calculateRemainingCredits(profile) <= 0) {
        throw new Error(t('yetersizHak'));
      }

      if (editEvent?.notification_ids?.length && editEvent?.notification_ids?.length > 0) {
        for (const notificationId of editEvent.notification_ids) {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
        }
      }

      // Etkinlik anından seçilen dakika kadar önce, kesin tarihe göre planla.
      const reminderSchedule = [];
      for (const dakika of reminderMinutes) {
        const triggerMs = eventTimestamp - dakika * 60000;
        if (triggerMs <= now) continue;
        const triggerDate = new Date(triggerMs);
        reminderSchedule.push(triggerDate.toISOString());
        const id = await Notifications.scheduleNotificationAsync({
          content: { 
            title: t('hatirlatmaBaslik'),
            body: `${baslik} ${t('vaktineAzKaldi')}`,
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
          },
        });
        yeniBildirimIdleri.push(id);
      }

      // Veritabanına gidecek veriler (Description çıkarıldı)
      const eventData = {
        user_id: user.id,
        title: baslik,
        category: kategori,
        event_date: formatLocalDate(date),
        event_time: formatLocalTime(date),
        notification_settings: bildirimler,
        notification_ids: yeniBildirimIdleri,
        notification_schedule: reminderSchedule,
      };

      if (editEvent) {
        const { error } = await supabase.from('events').update(eventData).eq('id', editEvent.id);
        if (error) throw error;
      } else {
        const { error: insError } = await supabase.from('events').insert([eventData]);
        if (insError) throw insError;

        const { error: profileError } = await supabase
          .from('profiles')
          .update({ used_credits: (profile.used_credits || 0) + 1 })
          .eq('id', user.id);

        if (profileError) throw profileError;
      }
      navigation.goBack();
    } catch (error) {
      for (const notificationId of yeniBildirimIdleri) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      }
      showAlert({ type: 'error', title: t('hata'), message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: Platform.OS === 'android' ? insets.top + 8 : insets.top,
              paddingBottom: Math.max(insets.bottom + 72, 96),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          
          <View style={styles.header}>
            <TouchableOpacity style={styles.geri} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.baslik}>{editEvent ? t('duzenle') : t('etkinlikEkle')}</Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={styles.label}>{t('etkinlikAdi')}</Text>
          <View style={styles.inputWrap}>
            <TextInput style={styles.input} placeholder={t('etkinlikAdi')} placeholderTextColor="#93A3BF" value={baslik} onChangeText={setBaslik} />
          </View>

          <Text style={styles.label}>{t('kategori')}</Text>
          <View style={styles.kategoriRow}>
            {KATEGORILER.map((k) => {
              const locked = premiumLocked && k.value !== 'Genel';
              return (
                <TouchableOpacity
                  key={k.value}
                  style={[
                    styles.kategoriButon,
                    kategori === k.value && { borderColor: k.renk, backgroundColor: k.renk + '20' },
                    locked && styles.kategoriButonDisabled,
                  ]}
                  onPress={() => handleKategoriSecimi(k.value)}
                >
                  <Ionicons name={k.ikon} size={18} color={kategori === k.value ? k.renk : '#93A3BF'} />
                  <Text style={[styles.kategoriText, kategori === k.value && { color: k.renk }]}>
                    {t(k.key)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.ikiliSatir}>
            <TouchableOpacity style={styles.seciciButon} onPress={() => openPicker('date')}>
              <Text style={styles.label}>{t('tarih')}</Text>
              <View style={styles.seciciKart}>
                <Ionicons name="calendar-outline" size={18} color="#7C9CFF" />
                <Text style={styles.seciciText}>{date.toLocaleDateString(locale)}</Text>
                <Ionicons name="chevron-forward" size={16} color="#93A3BF" style={styles.seciciArrow} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.seciciButon} onPress={() => openPicker('time')}>
              <Text style={styles.label}>{t('saat')}</Text>
              <View style={styles.seciciKart}>
                <Ionicons name="time-outline" size={18} color="#7C9CFF" />
                <Text style={styles.seciciText}>{date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</Text>
                <Ionicons name="chevron-forward" size={16} color="#93A3BF" style={styles.seciciArrow} />
              </View>
            </TouchableOpacity>
          </View>

          {Platform.OS === 'ios' && showPicker && (
            <DateTimePicker
              value={date}
              mode={mode}
              is24Hour={true}
              display="spinner"
              onChange={onChange}
              textColor="white"
            />
          )}

          <Text style={styles.label}>{t('bildirimZamanlari')}</Text>
          <View style={styles.bildirimGrid}>
            {BILDIRIMLER.map((b) => {
              const locked = premiumLocked && b.premium;
              return (
                <TouchableOpacity 
                  key={b.value} 
                  style={[
                    styles.bildirimKutu, 
                    bildirimler.includes(b.value) && styles.bildirimKutu_aktif,
                    locked && styles.bildirimKutuDisabled,
                  ]}
                  onPress={() => handleBildirimToggle(b.value, b.premium)}
                >
                  <Text style={[
                    styles.bildirimText, 
                    bildirimler.includes(b.value) && styles.bildirimText_aktif,
                    locked && styles.bildirimTextDisabled,
                  ]}>
                    {t(b.key)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={[styles.buton, loading && { opacity: 0.7 }]} onPress={kaydet} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.butonText}>{t('etkinligiKaydet')}</Text>}
          </TouchableOpacity>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 96 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  geri: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#182236', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2B3A57' },
  baslik: { fontSize: 18, fontWeight: '700', color: '#fff' },
  label: { fontSize: 13, color: '#93A3BF', marginBottom: 8, marginTop: 16 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#182236', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#2B3A57' },
  input: { flex: 1, fontSize: 15, color: '#ffffff' },
  seciciText: { color: '#ffffff', marginLeft: 10, fontSize: 14, flex: 1 },
  kategoriRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kategoriButon: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#182236', borderWidth: 1, borderColor: '#2B3A57' },
  kategoriText: { fontSize: 12, fontWeight: '500', color: '#93A3BF' },
  kategoriButonDisabled: { opacity: 0.5 },
  ikiliSatir: { flexDirection: Platform.OS === 'android' ? 'column' : 'row', gap: 10 },
  seciciButon: { flex: 1 },
  seciciKart: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#182236', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, borderWidth: 1, borderColor: '#2B3A57' },
  seciciArrow: { marginLeft: 8 },
  bildirimGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  bildirimKutu: { width: '48%', paddingVertical: 12, borderRadius: 12, backgroundColor: '#182236', borderWidth: 1, borderColor: '#2B3A57', alignItems: 'center' },
  bildirimKutu_aktif: { borderColor: '#7C9CFF', backgroundColor: '#7C9CFF20' },
  bildirimKutuDisabled: { opacity: 0.4, borderColor: '#55657F' },
  bildirimText: { fontSize: 13, color: '#93A3BF' },
  bildirimTextDisabled: { color: '#55657F' },
  bildirimText_aktif: { color: '#7C9CFF', fontWeight: 'bold' },
  buton: { backgroundColor: '#6C63FF', borderRadius: 14, paddingVertical: 16, marginTop: 30, alignItems: 'center', justifyContent: 'center', height: 56 },
  butonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
