export const CREDIT_PACKAGES = [
  {
    productId: 'credits_3',
    creditAmount: 3,
    label: '+3 Hak',
    fallbackPrice: '50 TL',
    color: '#72C9A3',
  },
  {
    productId: 'credits_5',
    creditAmount: 5,
    label: '+5 Hak',
    fallbackPrice: '75 TL',
    color: '#7C9CFF',
  },
  {
    productId: 'credits_10',
    creditAmount: 10,
    label: '+10 Hak',
    fallbackPrice: '100 TL',
    color: '#F28B82',
  },
  {
    productId: 'credits_20',
    creditAmount: 20,
    label: '+20 Hak',
    fallbackPrice: '150 TL',
    color: '#F2C66D',
  },
];

export function getCreditPackageByProductId(productId) {
  return CREDIT_PACKAGES.find((item) => item.productId === productId) || null;
}
