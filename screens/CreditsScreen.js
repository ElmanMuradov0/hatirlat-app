import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAlert } from '../components/AlertProvider';
import { useDil } from '../LanguageContext';
import i18n from '../i18n';
import { CREDIT_PACKAGES } from '../lib/creditPackages';
import { getLocalizedErrorMessage } from '../lib/errorMessages';
import {
  buildPendingCreditPurchase,
  getPendingCreditPurchases,
  markPendingCreditPurchaseProcessed,
  queuePendingCreditPurchase,
} from '../lib/pendingCreditPurchases';
import { ensureProfile } from '../lib/profile';
import {
  configureRevenueCat,
  getPremiumPurchaseTarget,
  getCreditProducts,
  getLatestTransactionForProduct,
  hasRevenueCatApiKey,
  isPremiumActive,
  isRevenueCatPurchaseCancelled,
  purchaseCreditProduct,
  purchasePremiumPackage,
  RevenueCatSetupError,
} from '../lib/revenuecat';
import { syncPremiumStatus } from '../lib/premiumSync';
import { supabase } from '../lib/supabase';

const REWARDED_IDS = {
  ios: 'ca-app-pub-3773141813813629/9162997199',
  android: 'ca-app-pub-3773141813813629/4758614684',
};

const TERMS_OF_USE_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_POLICY_URL = 'https://doc-hosting.flycricket.io/pingy-privacy-policy/10e1adf9-9bb1-4e40-a6ea-d9907135d4eb/privacy';

export default function CreditsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [purchaseLoadingId, setPurchaseLoadingId] = useState(null);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [premiumPurchaseTarget, setPremiumPurchaseTarget] = useState(null);
  const [packages, setPackages] = useState(
    CREDIT_PACKAGES.map((item) => ({ ...item, storeProduct: null }))
  );
  const { dil } = useDil();
  const t = (key, config) => i18n.t(key, config);
  const { showAlert, hideAlert } = useAlert();
  const getErrorMessage = (error, fallbackKey = 'islemTamamlanamadi') =>
    getLocalizedErrorMessage(error, t, fallbackKey);

  const hakEkle = async (miktar, options = {}) => {
    const {
      showSuccessAlert = true,
      showErrorAlert = true,
      onSuccess,
    } = options;

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t('oturumBulunamadi'));

      const profile = await ensureProfile(user.id);
      const yeniKredi = (profile.additional_credits || 0) + miktar;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ additional_credits: yeniKredi })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      if (onSuccess) {
        await onSuccess();
      }

      if (showSuccessAlert) {
        showAlert({
          type: 'success',
          title: t('basarili'),
          message: t('hakEklendi', { count: miktar }),
          actions: [
            { label: t('tamam'), variant: 'primary', onPress: () => navigation.goBack() },
          ],
        });
      }

      return true;
    } catch (error) {
      if (showErrorAlert) {
        showAlert({
          type: 'error',
          title: t('hata'),
          message: `${t('islemTamamlanamadi')}${getErrorMessage(error, 'hata')}`,
        });
      }

      return false;
    } finally {
      setLoading(false);
    }
  };

  const processPendingPurchases = async (userId) => {
    const pendingPurchases = await getPendingCreditPurchases(userId);

    for (const pendingPurchase of pendingPurchases) {
      const applied = await hakEkle(pendingPurchase.creditAmount, {
        showSuccessAlert: false,
        showErrorAlert: false,
      });

      if (applied) {
        await markPendingCreditPurchaseProcessed(userId, pendingPurchase.transactionId);
      }
    }
  };

  const loadCreditProducts = async () => {
    if (!hasRevenueCatApiKey()) {
      return [];
    }

    setProductsLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      await configureRevenueCat(user.id);
      await processPendingPurchases(user.id);

      const nextPackages = await getCreditProducts(user.id);
      setPackages(nextPackages);

      try {
        const fetchedPremiumPurchaseTarget = await getPremiumPurchaseTarget(user.id);
        setPremiumPurchaseTarget(fetchedPremiumPurchaseTarget);
      } catch (premiumError) {
        console.log(
          'Premium paketi yuklenemedi, kredi paketleri yine de gosterilecek:',
          premiumError?.message || premiumError
        );
        setPremiumPurchaseTarget(null);
      }

      try {
        await syncPremiumStatus(user.id);
      } catch (premiumSyncError) {
        console.log(
          'Premium durumu senkronlanamadi, kredi paketleri etkilenmeyecek:',
          premiumSyncError?.message || premiumSyncError
        );
      }
      return nextPackages;
    } catch (error) {
      console.log('Satın alma ürünleri alınamadı:', error.message);
      showAlert({
        type: 'error',
        title: t('hata'),
        message:
          error instanceof RevenueCatSetupError
            ? t('satinAlmaHazirDegil')
            : `${t('satinAlmalarYuklenemedi')} ${getErrorMessage(error, 'hata')}`,
      });
      return [];
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    loadCreditProducts();
  }, []);

  const rewardedAdBirHakVer = async () => {
    if (rewardLoading || loading) {
      return;
    }

    setRewardLoading(true);

    try {
      const adUnitId = __DEV__ ? TestIds.REWARDED : REWARDED_IDS[Platform.OS];
      const rewarded = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      await new Promise((resolve, reject) => {
        let rewardEarned = false;

        const unsubscribeLoaded = rewarded.addAdEventListener(
          RewardedAdEventType.LOADED,
          () => {
            rewarded.show().catch(reject);
          }
        );

        const unsubscribeReward = rewarded.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD,
          () => {
            rewardEarned = true;
          }
        );

        const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
          cleanup();
          if (rewardEarned) {
            resolve();
          } else {
            reject(new Error('reward_not_earned'));
          }
        });

        const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
          cleanup();
          reject(error);
        });

        const cleanup = () => {
          unsubscribeLoaded();
          unsubscribeReward();
          unsubscribeClosed();
          unsubscribeError();
        };

        rewarded.load();
      });

      await hakEkle(1);
    } catch (error) {
      if (error?.message === 'reward_not_earned') {
        showAlert({
          type: 'info',
          title: t('bilgi'),
          message: t('videoTamamlanmadi'),
        });
      } else {
        showAlert({
          type: 'error',
          title: t('hata'),
          message: getErrorMessage(error),
        });
      }
    } finally {
      setRewardLoading(false);
    }
  };

  const satinAl = async (paket) => {
    let secilenPaket = paket;

    if (!secilenPaket?.storeProduct) {
      const refreshedPackages = await loadCreditProducts();
      secilenPaket =
        refreshedPackages.find((item) => item.productId === paket?.productId) || secilenPaket;
    }

    if (!secilenPaket?.storeProduct) {
      console.log('Satın alma başlatılamadı: mağaza ürünü bulunamadı.', {
        productId: paket?.productId,
        hasRevenueCatApiKey: hasRevenueCatApiKey(),
      });
      showAlert({
        type: 'info',
        title: t('bilgi'),
        message: `${hasRevenueCatApiKey() ? t('magazaUrunuHazirDegil') : t('satinAlmaHazirDegil')} (ID: ${paket?.productId || '-'})`,
      });
      return;
    }

    setPurchaseLoadingId(secilenPaket.productId);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t('oturumBulunamadi'));

      await configureRevenueCat(user.id);

      console.log('Satın alma başlatılıyor...', {
        productId: secilenPaket.productId,
        price: secilenPaket.storeProduct?.priceString,
      });

      const { customerInfo } = await purchaseCreditProduct(secilenPaket.storeProduct, user.id);
      const latestTransaction = getLatestTransactionForProduct(customerInfo, secilenPaket.productId);
      const pendingPurchase = buildPendingCreditPurchase(latestTransaction);

      if (pendingPurchase) {
        await queuePendingCreditPurchase(user.id, pendingPurchase);
      }

      const credited = await hakEkle(secilenPaket.creditAmount, {
        showSuccessAlert: false,
        showErrorAlert: false,
        onSuccess: async () => {
          if (pendingPurchase) {
            await markPendingCreditPurchaseProcessed(user.id, pendingPurchase.transactionId);
          }
        },
      });

      if (!credited) {
        showAlert({
          type: 'info',
          title: t('bilgi'),
          message: t('satinAlmaTamamlandiAmaHakBekliyor'),
        });
        return;
      }

      showAlert({
        type: 'success',
        title: t('basarili'),
        message: t('hakEklendi', { count: secilenPaket.creditAmount }),
        actions: [
          { label: t('tamam'), variant: 'primary', onPress: () => navigation.goBack() },
        ],
      });
    } catch (error) {
      if (isRevenueCatPurchaseCancelled(error)) {
        showAlert({
          type: 'info',
          title: t('bilgi'),
          message: t('satinAlmaIptalEdildi'),
        });
      } else {
        showAlert({
          type: 'error',
          title: t('hata'),
          message:
            error instanceof RevenueCatSetupError
              ? t('satinAlmaHazirDegil')
              : getErrorMessage(error),
        });
      }
    } finally {
      setPurchaseLoadingId(null);
    }
  };

  const premiumSatinAl = async () => {
    if (premiumLoading || loading || rewardLoading || purchaseLoadingId) {
      return;
    }

    setPremiumLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t('oturumBulunamadi'));

      await configureRevenueCat(user.id);

      const targetPackage = premiumPurchaseTarget || (await getPremiumPurchaseTarget(user.id));
      if (!targetPackage) {
        showAlert({
          type: 'info',
          title: t('bilgi'),
          message: t('premiumPaketHazirDegil'),
        });
        return;
      }

      const { customerInfo } = await purchasePremiumPackage(targetPackage, user.id);
      const premiumEnabled = isPremiumActive(customerInfo);

      await syncPremiumStatus(user.id, customerInfo);

      if (!premiumEnabled) {
        showAlert({
          type: 'warning',
          title: t('premium'),
          message: t('premiumDurumuDogrulanamadi'),
        });
        return;
      }

      showAlert({
        type: 'success',
        title: t('premium'),
        message: t('premiumAktifMesaj'),
        actions: [
          { label: t('tamam'), variant: 'primary', onPress: () => navigation.goBack() },
        ],
      });
    } catch (error) {
      console.log('Premium satin alma hatasi:', {
        message: error?.message,
        code: error?.code,
        underlyingErrorMessage: error?.underlyingErrorMessage,
        userInfo: error?.userInfo,
      });

      if (isRevenueCatPurchaseCancelled(error)) {
        showAlert({
          type: 'info',
          title: t('bilgi'),
          message: t('satinAlmaIptalEdildi'),
        });
      } else {
        showAlert({
          type: 'error',
          title: t('hata'),
          message: getErrorMessage(error),
        });
      }
    } finally {
      setPremiumLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const premiumPriceText =
    premiumPurchaseTarget?.value?.product?.priceString ||
    premiumPurchaseTarget?.value?.priceString ||
    t('premiumFiyatBilinmiyor');

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === 'android' ? insets.top + 12 : insets.top + 4 },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.ustButon}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.baslik}>{t('hakAl')}</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.ustButon}>
          <Ionicons name="log-out-outline" size={24} color="#F28B82" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingAlan}>
          <ActivityIndicator size="large" color="#7C9CFF" />
          <Text style={styles.loadingText}>{t('islemGerceklesiyor')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity
            style={styles.videoKart}
            onPress={rewardedAdBirHakVer}
            disabled={rewardLoading || loading || Boolean(purchaseLoadingId)}
          >
            <View style={styles.videoIcerik}>
              <Ionicons name="play-circle" size={40} color="#F2C66D" />
              <View>
                <Text style={styles.videoBaslik}>{t('ucretsizHak')}</Text>
                <Text style={styles.videoAlt}>
                  {rewardLoading ? t('videoYukleniyor') : t('videoAlt')}
                </Text>
              </View>
            </View>
            {rewardLoading ? (
              <ActivityIndicator color="#F2C66D" />
            ) : (
              <Text style={styles.artiBir}>+1</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.bolumBaslik}>{t('paketSat')}</Text>
          {productsLoading ? (
            <View style={styles.productsLoadingRow}>
              <ActivityIndicator color="#7C9CFF" />
              <Text style={styles.productsLoadingText}>{t('urunlerYukleniyor')}</Text>
            </View>
          ) : null}

          <View style={styles.paketGrid}>
            {packages.map((paket) => (
              <TouchableOpacity
                key={paket.productId}
                style={styles.paketKart}
                disabled={Boolean(purchaseLoadingId) || loading}
                onPress={() => {
                  showAlert({
                    type: 'info',
                    title: t('satinal'),
                    message: `${paket.label} ${t('almakIsterMisin')}`,
                    dismissOnBackdrop: false,
                    actions: [
                      { label: t('vazgec'), variant: 'ghost' },
                      {
                        label: t('satinal'),
                        variant: 'primary',
                        autoClose: false,
                        onPress: async () => {
                          hideAlert();
                          await satinAl(paket);
                        },
                      },
                    ],
                  });
                }}
              >
                <View style={[styles.paketIcon, { backgroundColor: `${paket.color}20` }]}>
                  <Ionicons name="flash" size={24} color={paket.color} />
                </View>
                <Text style={styles.paketHak}>{paket.label}</Text>
                {purchaseLoadingId === paket.productId ? (
                  <ActivityIndicator color={paket.color} style={styles.paketLoading} />
                ) : (
                  <Text style={styles.paketFiyat}>
                    {paket.storeProduct?.priceString || paket.fallbackPrice}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 16, 30) }]}>
        <TouchableOpacity
          style={styles.premiumButon}
          disabled={premiumLoading || loading || rewardLoading || Boolean(purchaseLoadingId)}
          onPress={() =>
            showAlert({
              type: 'info',
              title: t('premium'),
              message: t('premiumSatinAlmaOnayi'),
              dismissOnBackdrop: false,
              actions: [
                { label: t('vazgec'), variant: 'ghost' },
                {
                  label: t('satinal'),
                  variant: 'primary',
                  autoClose: false,
                  onPress: async () => {
                    hideAlert();
                    await premiumSatinAl();
                  },
                },
              ],
            })
          }
        >
          <Text style={styles.premiumText}>{t('premium')}</Text>
          {premiumLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          )}
        </TouchableOpacity>
        <View style={styles.subscriptionInfoCard}>
          <Text style={styles.subscriptionInfoTitle}>{t('abonelikBilgisiBaslik')}</Text>
          <Text style={styles.subscriptionInfoText}>
            {t('abonelikBilgisiIcerik', { price: premiumPriceText })}
          </Text>
          <View style={styles.linksRow}>
            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
              <Text style={styles.legalLink}>{t('gizlilikPolitikasi')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(TERMS_OF_USE_URL)}>
              <Text style={styles.legalLink}>{t('kullanimKosullari')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  loadingAlan: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  ustButon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#182236',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baslik: { color: '#fff', fontSize: 18, fontWeight: '700' },
  scroll: { padding: 20 },
  videoKart: {
    backgroundColor: '#182236',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F2C66D',
  },
  videoIcerik: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  videoBaslik: { color: '#fff', fontSize: 16, fontWeight: '600' },
  videoAlt: { color: '#93A3BF', fontSize: 12 },
  artiBir: { color: '#F2C66D', fontSize: 24, fontWeight: 'bold' },
  bolumBaslik: {
    color: '#93A3BF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 30,
    marginBottom: 15,
  },
  productsLoadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  productsLoadingText: { color: '#93A3BF', marginLeft: 10, fontSize: 13 },
  paketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  paketKart: {
    width: '45%',
    backgroundColor: '#182236',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2B3A57',
  },
  paketIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  paketHak: { color: '#fff', fontSize: 16, fontWeight: '700' },
  paketFiyat: { color: '#93A3BF', fontSize: 14, marginTop: 5 },
  paketLoading: { marginTop: 6 },
  footer: { padding: 20, paddingBottom: 30 },
  premiumButon: {
    backgroundColor: '#7C9CFF',
    padding: 20,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  premiumText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  subscriptionInfoCard: {
    marginTop: 12,
    backgroundColor: '#182236',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2B3A57',
  },
  subscriptionInfoTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  subscriptionInfoText: {
    color: '#C7D2E8',
    fontSize: 12,
    lineHeight: 18,
  },
  linksRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legalLink: {
    color: '#7C9CFF',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
