import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCreditPackageByProductId } from './creditPackages';

function getPendingKey(userId) {
  return `pending_credit_purchases:${userId}`;
}

function getProcessedKey(userId) {
  return `processed_credit_purchases:${userId}`;
}

async function readJson(key, fallbackValue) {
  const rawValue = await AsyncStorage.getItem(key);
  if (!rawValue) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallbackValue;
  }
}

async function writeJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export function buildPendingCreditPurchase(transaction) {
  const packageInfo = getCreditPackageByProductId(transaction?.productIdentifier);
  if (!packageInfo || !transaction?.transactionIdentifier) {
    return null;
  }

  return {
    transactionId: transaction.transactionIdentifier,
    productId: transaction.productIdentifier,
    creditAmount: packageInfo.creditAmount,
    purchaseDate: transaction.purchaseDate || new Date().toISOString(),
  };
}

export async function queuePendingCreditPurchase(userId, pendingPurchase) {
  if (!userId || !pendingPurchase?.transactionId) {
    return false;
  }

  const processedIds = await readJson(getProcessedKey(userId), []);
  if (processedIds.includes(pendingPurchase.transactionId)) {
    return false;
  }

  const pendingPurchases = await readJson(getPendingKey(userId), []);
  const alreadyQueued = pendingPurchases.some(
    (item) => item.transactionId === pendingPurchase.transactionId
  );

  if (alreadyQueued) {
    return false;
  }

  pendingPurchases.push(pendingPurchase);
  await writeJson(getPendingKey(userId), pendingPurchases);
  return true;
}

export async function getPendingCreditPurchases(userId) {
  if (!userId) {
    return [];
  }

  return readJson(getPendingKey(userId), []);
}

export async function markPendingCreditPurchaseProcessed(userId, transactionId) {
  if (!userId || !transactionId) {
    return;
  }

  const processedIds = await readJson(getProcessedKey(userId), []);
  if (!processedIds.includes(transactionId)) {
    processedIds.push(transactionId);
    await writeJson(getProcessedKey(userId), processedIds);
  }

  const pendingPurchases = await readJson(getPendingKey(userId), []);
  const nextPending = pendingPurchases.filter((item) => item.transactionId !== transactionId);
  await writeJson(getPendingKey(userId), nextPending);
}
