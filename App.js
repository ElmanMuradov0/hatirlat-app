import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Platform, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './lib/supabase';
import { setLatestDeepLink } from './lib/deepLinkStore';

// EKRANLAR
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import AddEventScreen from './screens/AddEventScreen';
import CreditsScreen from './screens/CreditsScreen';
import AuthConfirmScreen from './screens/AuthConfirmScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';

// DİL DESTEĞİ (Eğer LanguageContext.js dosyan varsa)
import { LanguageProvider } from './LanguageContext'; 
import { AlertProvider } from './components/AlertProvider';
import { configureRevenueCat, hasRevenueCatApiKey } from './lib/revenuecat';

const Stack = createNativeStackNavigator();
const linking = {
  prefixes: ['pingy://'],
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url) {
      setLatestDeepLink(url);
    }
    return url;
  },
  subscribe(listener) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      setLatestDeepLink(url);
      listener(url);
    });

    return () => subscription.remove();
  },
  config: {
    screens: {
      Login: 'login',
      Register: 'register',
      Home: 'home',
      AddEvent: 'add-event',
      Credits: 'credits',
      AuthConfirm: 'auth/confirm',
      ResetPassword: 'auth/reset-password',
    },
  },
};

// Bildirim Ayarı
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  
  useEffect(() => {
    const askPermission = async () => {
      if (Device.isDevice) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('Bildirim izni reddedildi!');
        }
      }
    };
    askPermission();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Pingy Hatirlatmalari',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C9CFF',
      });
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.log('Oturum alınamadı:', error.message);
      }

      if (isMounted) {
        setSession(data?.session ?? null);
        setReady(true);
      }
    };

    bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready || !hasRevenueCatApiKey()) {
      return;
    }

    const syncRevenueCatUser = async () => {
      try {
        await configureRevenueCat(session?.user?.id ?? null);
      } catch (error) {
        console.log('RevenueCat hazirlanamadi:', error.message);
      }
    };

    syncRevenueCatUser();
  }, [ready, session?.user?.id]);

  if (!ready) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C9CFF" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider> 
        <AlertProvider>
          <NavigationContainer linking={linking}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
            {session ? (
              <>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="AddEvent" component={AddEventScreen} />
                <Stack.Screen name="Credits" component={CreditsScreen} />
                <Stack.Screen name="AuthConfirm" component={AuthConfirmScreen} />
                <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
              </>
            ) : (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="AuthConfirm" component={AuthConfirmScreen} />
                <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
              </>
            )}
            </Stack.Navigator>
          </NavigationContainer>
        </AlertProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
