import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY!;
const REVENUECAT_GOOGLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY!;

export function configureRevenueCat() {
  Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

  if (Platform.OS === 'ios') {
    Purchases.configure({ apiKey: REVENUECAT_APPLE_KEY });
  } else if (Platform.OS === 'android') {
    Purchases.configure({ apiKey: REVENUECAT_GOOGLE_KEY });
  }
}

export { Purchases };
