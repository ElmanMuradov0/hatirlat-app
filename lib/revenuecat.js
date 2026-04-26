import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases from 'react-native-purchases';

import { CREDIT_PACKAGES } from './creditPackages';

class RevenueCatSetupError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RevenueCatSetupError';
    this.code = code;
  }
}

let isConfigured = false;
let configuredAppUserId = null;

function getExpoExtra() {
  return (
    Constants.expoConfig?.extra ||
    Constants.manifest2?.extra?.expoClient?.extra ||
    Constants.manifest?.extra ||
    {}
  );
}

function getRevenueCatConfig() {
  const extra = getExpoExtra();
  return extra?.revenueCat || {};
}

export function getRevenueCatApiKey() {
  const revenueCatConfig = getRevenueCatConfig();

  if (Platform.OS === 'android') {
    return revenueCatConfig.androidApiKey || '';
  }

  if (Platform.OS === 'ios') {
    return revenueCatConfig.iosApiKey || '';
  }

  return '';
}

export function hasRevenueCatApiKey() {
  return Boolean(getRevenueCatApiKey());
}

export function getPremiumEntitlementId() {
  return getRevenueCatConfig().premiumEntitlementId || 'premium';
}

export function getPremiumOfferingId() {
  return getRevenueCatConfig().premiumOfferingId || 'default';
}

export function getPremiumProductId() {
  return getRevenueCatConfig().premiumProductId || '';
}

export async function configureRevenueCat(appUserId) {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return false;
  }

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    throw new RevenueCatSetupError(
      'missing_api_key',
      'RevenueCat API key is missing for the current platform.'
    );
  }

  if (!isConfigured) {
    if (__DEV__) {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    }

    Purchases.configure({
      apiKey,
      appUserID: appUserId || undefined,
    });

    isConfigured = true;
    configuredAppUserId = appUserId || null;
    return true;
  }

  if (appUserId && configuredAppUserId !== appUserId) {
    await Purchases.logIn(appUserId);
    configuredAppUserId = appUserId;
  } else if (appUserId === null && configuredAppUserId) {
    await Purchases.logOut();
    configuredAppUserId = null;
  }

  return true;
}

export async function getCreditProducts(appUserId) {
  await configureRevenueCat(appUserId);

  const storeProducts = await Purchases.getProducts(
    CREDIT_PACKAGES.map((item) => item.productId),
    Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION
  );

  return CREDIT_PACKAGES.map((item) => ({
    ...item,
    storeProduct:
      storeProducts.find((product) => product.identifier === item.productId) || null,
  }));
}

export async function purchaseCreditProduct(storeProduct, appUserId) {
  await configureRevenueCat(appUserId);

  if (!storeProduct) {
    throw new RevenueCatSetupError('missing_product', 'Store product is not loaded.');
  }

  return Purchases.purchaseStoreProduct(storeProduct, null, false);
}

export async function getCustomerInfo(appUserId) {
  await configureRevenueCat(appUserId);
  return Purchases.getCustomerInfo();
}

export function isPremiumActive(customerInfo, entitlementId = getPremiumEntitlementId()) {
  return Boolean(customerInfo?.entitlements?.active?.[entitlementId]);
}

export async function getPremiumPackage(appUserId) {
  await configureRevenueCat(appUserId);

  const offerings = await Purchases.getOfferings();
  const preferredOfferingId = getPremiumOfferingId();
  const selectedOffering =
    offerings?.all?.[preferredOfferingId] ||
    offerings?.current ||
    Object.values(offerings?.all || {})[0] ||
    null;

  if (!selectedOffering) {
    return null;
  }

  return (
    selectedOffering.monthly ||
    selectedOffering.annual ||
    selectedOffering.sixMonth ||
    selectedOffering.threeMonth ||
    selectedOffering.twoMonth ||
    selectedOffering.weekly ||
    selectedOffering.availablePackages?.[0] ||
    null
  );
}

export async function getPremiumStoreProduct(appUserId) {
  await configureRevenueCat(appUserId);

  const productId = getPremiumProductId();
  if (!productId) {
    return null;
  }

  const storeProducts = await Purchases.getProducts(
    [productId],
    Purchases.PRODUCT_CATEGORY.SUBSCRIPTION
  );

  return storeProducts.find((product) => product.identifier === productId) || null;
}

export async function getPremiumPurchaseTarget(appUserId) {
  try {
    const premiumPackage = await getPremiumPackage(appUserId);
    if (premiumPackage) {
      return {
        type: 'package',
        value: premiumPackage,
      };
    }
  } catch (error) {
    if (!getPremiumProductId()) {
      throw error;
    }
  }

  const premiumStoreProduct = await getPremiumStoreProduct(appUserId);
  if (!premiumStoreProduct) {
    return null;
  }

  return {
    type: 'storeProduct',
    value: premiumStoreProduct,
  };
}

export async function purchasePremiumPackage(premiumPurchaseTarget, appUserId) {
  await configureRevenueCat(appUserId);

  if (!premiumPurchaseTarget?.value) {
    throw new RevenueCatSetupError(
      'missing_premium_package',
      'Premium package is not loaded.'
    );
  }

  if (premiumPurchaseTarget.type === 'storeProduct') {
    return Purchases.purchaseStoreProduct(premiumPurchaseTarget.value, null, false);
  }

  return Purchases.purchasePackage(premiumPurchaseTarget.value);
}

export function getLatestTransactionForProduct(customerInfo, productId) {
  const transactions = customerInfo?.nonSubscriptionTransactions || [];
  const matchingTransactions = transactions
    .filter((transaction) => transaction.productIdentifier === productId)
    .sort(
      (left, right) =>
        new Date(right.purchaseDate).getTime() - new Date(left.purchaseDate).getTime()
    );

  return matchingTransactions[0] || null;
}

export function isRevenueCatPurchaseCancelled(error) {
  return (
    error?.userCancelled === true ||
    error?.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}

export { RevenueCatSetupError };
