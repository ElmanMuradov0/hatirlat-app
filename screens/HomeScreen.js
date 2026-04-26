import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Modal, Platform } from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calculateRemainingCredits, ensureProfile } from '../lib/profile';
import { syncPremiumStatus } from '../lib/premiumSync';
import i18n from '../i18n';
import { useDil } from '../LanguageContext';
import { useAlert } from '../components/AlertProvider';
import { getLocalizedErrorMessage } from '../lib/errorMessages';

const KATEGORILER = [
  { value: 'Tümü', key: 'tumü' },
  { value: 'Sağlık', key: 'saglik' },
  { value: 'Ders', key: 'ders' },
  { value: 'İş', key: 'is' },
  { value: 'Genel', key: 'genel' },
];

const DILLER = [
  { kod: 'tr', ad: 'Türkçe', bayrak: '🇹🇷' },
  { kod: 'en', ad: 'English', bayrak: '🇬🇧' },
];

const CATEGORY_COLORS = {
  'Sağlık': '#F28B82',
  Ders: '#7C9CFF',
  'İş': '#72C9A3',
  Genel: '#F2C66D',
  'Tümü': '#7C8CA5',
};

const getEventTimestamp = (event) => {
  if (!event?.event_date || !event?.event_time) {
    return NaN;
  }

  const [year, month, day] = event.event_date.split('-').map(Number);
  const [hours = 0, minutes = 0, seconds = 0] = event.event_time.split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hours, minutes, seconds).getTime();
};

const getCleanupTimestamp = (event) => {
  const reminderTimestamps = Array.isArray(event?.notification_schedule)
    ? event.notification_schedule
        .map((value) => new Date(value).getTime())
        .filter((value) => !Number.isNaN(value))
        .sort((a, b) => a - b)
    : [];

  if (reminderTimestamps.length > 0) {
    return reminderTimestamps[0];
  }

  return getEventTimestamp(event);
};

export default function HomeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [aktifKategori, setAktifKategori] = useState('Tümü');
  const [etkinlikler, setEtkinlikler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kalanHak, setKalanHak] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [ad, setAd] = useState(route.params?.ad || 'Kullanıcı');
  const [dilModal, setDilModal] = useState(false);
  const { dil, dilDegistir } = useDil();
  const t = (key) => i18n.t(key);
  const { showAlert } = useAlert();
  const getErrorMessage = (error, fallbackKey = 'islemTamamlanamadi') =>
    getLocalizedErrorMessage(error, t, fallbackKey);

  useFocusEffect(
    useCallback(() => {
      verileriGetir();
      const interval = setInterval(() => {
        verileriGetir();
      }, 120000);

      return () => clearInterval(interval);
    }, [])
  );

  const verileriGetir = async () => {
    setLoading(true);
    setProfileReady(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setAd(user.user_metadata?.first_name || 'Kullanıcı');
      try {
        await syncPremiumStatus(user.id);
      } catch (premiumSyncError) {
        console.log('Premium durumu senkronlanamadi:', premiumSyncError?.message || premiumSyncError);
      }

      const { data: events, error: evError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('event_date', { ascending: true });

      if (evError) throw evError;
      const allEvents = events || [];
      const now = Date.now();
      const expiredEvents = allEvents.filter((event) => {
        const cleanupTimestamp = getCleanupTimestamp(event);
        return !Number.isNaN(cleanupTimestamp) && cleanupTimestamp <= now;
      });

      if (expiredEvents.length > 0) {
        for (const event of expiredEvents) {
          if (Array.isArray(event.notification_ids)) {
            for (const notificationId of event.notification_ids) {
              try {
                await Notifications.cancelScheduledNotificationAsync(notificationId);
              } catch (notificationError) {
                console.log('Bildirim temizlenemedi:', notificationError?.message || notificationError);
              }
            }
          }
        }

        const expiredIds = expiredEvents.map((event) => event.id);
        const { error: deleteExpiredError } = await supabase
          .from('events')
          .delete()
          .in('id', expiredIds);

        if (deleteExpiredError) {
          throw deleteExpiredError;
        }
      }

      setEtkinlikler(
        allEvents.filter((event) => {
          const cleanupTimestamp = getCleanupTimestamp(event);
          return Number.isNaN(cleanupTimestamp) || cleanupTimestamp > now;
        })
      );

      const profile = await ensureProfile(user.id);
      setIsPremium(!!profile.is_premium);
      setKalanHak(calculateRemainingCredits(profile));
      setProfileReady(true);

    } catch (error) {
      console.log('Veri çekme hatası:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const sil = (id, notificationIds) => {
    const performDelete = async () => {
      try {
        if (notificationIds && Array.isArray(notificationIds)) {
          for (const nId of notificationIds) {
            await Notifications.cancelScheduledNotificationAsync(nId);
          }
        }
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) throw error;
        verileriGetir(); 
      } catch (err) {
        showAlert({
          type: 'error',
          title: t('hata'),
          message: t('silmeBasarisiz', { message: getErrorMessage(err) }),
        });
      }
    };

    showAlert({
      type: 'warning',
      title: t('sil'),
      message: t('silOnay'),
      dismissOnBackdrop: false,
      actions: [
        { label: t('vazgec'), variant: 'ghost' },
        { label: t('sil'), variant: 'destructive', onPress: performDelete },
      ],
    });
  };

  const filtreliEtkinlikler = aktifKategori === 'Tümü'
    ? etkinlikler
    : etkinlikler.filter(e => e.category === aktifKategori);

  const showPremiumInfo = () => {
    showAlert({
      type: 'info',
      title: t('premium'),
      message: t('premiumAktifMesaj'),
    });
  };

  return (
    <>
      <View style={styles.container}>
        <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? insets.top + 14 : insets.top + 8 }]}>
        <View>
          <Text style={styles.merhaba}>{t('merhaba')}, {ad} 👋</Text>
          <Text style={styles.baslik}>{t('etkinliklerim')}</Text>
        </View>
        <View style={styles.headerSag}>
          {profileReady ? (
            isPremium ? (
              <TouchableOpacity style={styles.premiumBadge} onPress={showPremiumInfo}>
                <Ionicons name="diamond-outline" size={14} color="#F2C66D" />
              </TouchableOpacity>
            ) : null
          ) : (
            <View style={styles.headerBadgePlaceholder} />
          )}
          
          <TouchableOpacity style={styles.dilButon} onPress={() => setDilModal(true)}>
            <Ionicons name="globe-outline" size={16} color="#fff" />
            <Text style={styles.dilButonText}>{dil === 'tr' ? 'TR' : 'EN'}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.cikisButon} 
            onPress={async () => {
              await supabase.auth.signOut();
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#F28B82" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.kategoriBar}>
        <FlatList
          horizontal
          data={KATEGORILER}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kategoriListe}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.kategoriButon,
                aktifKategori === item.value && {
                  backgroundColor: CATEGORY_COLORS[item.value] || '#6C63FF',
                  borderColor: CATEGORY_COLORS[item.value] || '#6C63FF',
                },
              ]}
              onPress={() => setAktifKategori(item.value)}
            >
              <Text
                style={[
                  styles.kategoriText,
                  aktifKategori === item.value && styles.kategoriText_aktif,
                ]}
              >
                {t(item.key)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.merkez}>
          <ActivityIndicator size="large" color="#7C9CFF" />
        </View>
      ) : (
        <FlatList
          data={filtreliEtkinlikler}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.liste}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.merkez}>
              <Ionicons name="calendar-outline" size={48} color="#2B3A57" />
              <Text style={styles.bosText}>{t('henuzEtkinlik')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.kart}
              onPress={() => navigation.navigate('AddEvent', { event: item })}
              activeOpacity={0.9}
            >
              <View style={[styles.kartRenkBar, { backgroundColor: CATEGORY_COLORS[item.category] || '#F2C66D' }]} />
              <View style={styles.kartIcerik}>
                <View style={styles.kartUst}>
                  <Text
                    style={[
                      styles.kartBaslik,
                      { color: CATEGORY_COLORS[item.category] || '#ffffff' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <View style={styles.kartAksiyon}>
                    <TouchableOpacity onPress={() => navigation.navigate('AddEvent', { event: item })}>
                      <Ionicons name="create-outline" size={18} color="#6C63FF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => sil(item.id, item.notification_ids)}>
                      <Ionicons name="trash-outline" size={18} color="#F28B82" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.kartAlt}>
                  <Ionicons
                    name="time-outline"
                    size={12}
                    color={CATEGORY_COLORS[item.category] || '#93A3BF'}
                  />
                  <Text
                    style={[
                      styles.kartZaman,
                      { color: CATEGORY_COLORS[item.category] || '#93A3BF' },
                    ]}
                  >
                    {item.event_date} • {(item.event_time || '').substring(0, 5)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {!isPremium && profileReady && (
        <TouchableOpacity
          style={[
            styles.hakWrapFloating,
            { bottom: Math.max(insets.bottom + 34, 48) },
          ]}
          onPress={() => navigation.navigate('Credits')}
        >
          <Ionicons name="flash" size={14} color="#F2C66D" />
          <Text style={styles.hakText}>{kalanHak} {t('hak')}</Text>
        </TouchableOpacity>
      )}

      {/* YENİ EKLE BUTONU - NAVIGASYON KONTROLÜ EKLENDİ */}
          <TouchableOpacity 
            style={[
              styles.ekleButon,
              {
                backgroundColor: kalanHak <= 0 ? '#2B3A57' : '#6C63FF',
                bottom: Math.max(insets.bottom + 20, 34),
              },
            ]}
            onPress={() => {
              if (!isPremium && kalanHak <= 0) {
                showAlert({ type: 'warning', title: t('hakBitti'), message: t('hakBittiAciklama') });
              } else {
                navigation.navigate('AddEvent');
              }
            }}
          >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

    </View>
      <Modal visible={dilModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setDilModal(false)}>
          <View style={styles.modalKutu}>
            {DILLER.map((d) => (
              <TouchableOpacity
                key={d.kod}
                style={[styles.dilSecenegi, dil === d.kod && styles.dilSecenekAktif]}
                onPress={() => {
                  dilDegistir(d.kod);
                  setDilModal(false);
                }}
              >
                <Text style={styles.dilBayrak}>{d.bayrak}</Text>
                <Text style={styles.dilAd}>{d.ad}</Text>
                {dil === d.kod && <Ionicons name="checkmark" size={16} color="#6C63FF" style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 18 },
  merhaba: { fontSize: 13, color: '#93A3BF', fontWeight: '500' },
  baslik: { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 2 },
  headerSag: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  headerBadgePlaceholder: { width: 76, height: 34 },
  hakWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#182236', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, gap: 4, borderWidth: 1, borderColor: '#F2C66D' },
  hakWrapFloating: { position: 'absolute', left: 24, flexDirection: 'row', alignItems: 'center', backgroundColor: '#182236', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 8, gap: 4, borderWidth: 1, borderColor: '#F2C66D', maxWidth: '62%' },
  hakText: { color: '#F2C66D', fontSize: 14, fontWeight: 'bold' },
  premiumBadge: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#182236', borderRadius: 17, borderWidth: 1, borderColor: '#F2C66D' },
  cikisButon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#182236', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2B3A57' },
  dilButon: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#182236', borderWidth: 1, borderColor: '#2B3A57', gap: 4 },
  dilButonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  kategoriBar: { marginBottom: 6 },
  kategoriListe: { paddingHorizontal: 24, gap: 10, paddingVertical: 4, alignItems: 'center' },
  kategoriButon: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#182236', borderWidth: 1, borderColor: '#2B3A57' },
  kategoriText: { color: '#93A3BF', fontSize: 13, fontWeight: '500' },
  kategoriText_aktif: { color: '#fff' },
  liste: { paddingHorizontal: 24, paddingBottom: 100 },
  kart: { backgroundColor: '#182236', borderRadius: 16, marginBottom: 12, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: '#2B3A57' },
  kartRenkBar: { width: 4 },
  kartIcerik: { flex: 1, padding: 16 },
  kartUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  kartBaslik: { fontSize: 15, fontWeight: '600', color: '#fff', flex: 1, marginRight: 10 },
  kartAksiyon: { flexDirection: 'row', gap: 15 },
  kartAlt: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kartZaman: { fontSize: 12, color: '#93A3BF' },
  merkez: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  bosText: { color: '#93A3BF', fontSize: 14, marginTop: 10 },
  ekleButon: { position: 'absolute', right: 24, width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#6C63FF', shadowOpacity: 0.26, shadowOffset: { width: 0, height: 10 }, shadowRadius: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 80, paddingRight: 24 },
  modalKutu: { backgroundColor: '#182236', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2B3A57', minWidth: 160 },
  dilSecenegi: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  dilSecenekAktif: { backgroundColor: '#2B3A57' },
  dilBayrak: { fontSize: 18 },
  dilAd: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
