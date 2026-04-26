import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AlertContext = createContext({
  showAlert: () => {},
  hideAlert: () => {},
});

export const useAlert = () => useContext(AlertContext);

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null);

  const showAlert = useCallback((payload) => {
    setAlert((prev) => ({
      ...payload,
      id: prev?.id === payload?.id ? Date.now() : payload?.id ?? Date.now(),
      visible: true,
    }));
  }, []);

  const hideAlert = useCallback(() => setAlert(null), []);

  const contextValue = useMemo(() => ({ showAlert, hideAlert }), [showAlert, hideAlert]);

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
      <AlertPopup alert={alert} onDismiss={hideAlert} />
    </AlertContext.Provider>
  );
}

const TYPE_MAP = {
  success: { color: '#72C9A3', icon: 'checkmark-circle-outline', title: 'Başarılı' },
  error: { color: '#F28B82', icon: 'alert-circle-outline', title: 'Hata' },
  warning: { color: '#F3BE6A', icon: 'warning-outline', title: 'Uyarı' },
  info: { color: '#7CC7FF', icon: 'information-circle-outline', title: 'Bilgi' },
};

function AlertPopup({ alert, onDismiss }) {
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (alert) {
      scale.setValue(0.9);
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }).start();
    }
  }, [alert, scale]);

  useEffect(() => {
    if (alert?.autoHide) {
      const timeout = setTimeout(() => {
        onDismiss();
      }, alert.autoHide);
      return () => clearTimeout(timeout);
    }
  }, [alert, onDismiss]);

  if (!alert) {
    return null;
  }

  const { type = 'info', title, message, actions } = alert;
  const config = TYPE_MAP[type] ?? TYPE_MAP.info;

  const actionVariants = {
    primary: { backgroundColor: config.color, borderColor: config.color },
    destructive: { backgroundColor: 'rgba(255, 107, 107, 0.1)', borderColor: '#F28B82' },
    ghost: { backgroundColor: 'transparent', borderColor: 'rgba(255, 255, 255, 0.2)' },
  };

  const textVariants = {
    primary: { color: '#fff' },
    destructive: { color: '#F28B82' },
    ghost: { color: '#fff' },
  };

  const renderedActions = actions?.length
    ? actions
    : [
        {
          label: 'Tamam',
          variant: 'primary',
        },
      ];

  const handleAction = (action) => {
    if (action.onPress) {
      action.onPress();
    }
    if (action.autoClose ?? true) {
      onDismiss();
    }
  };

  return (
    <Modal transparent animationType="fade" visible>
      <TouchableWithoutFeedback onPress={alert.dismissOnBackdrop ?? true ? onDismiss : undefined}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.card, { transform: [{ scale }], borderColor: config.color }] }>
              <View style={styles.header}>
                <Ionicons name={config.icon} size={32} color={config.color} />
                <View style={styles.headerText}>
                  <Text style={styles.title}>{title ?? config.title}</Text>
                  {message ? <Text style={styles.message}>{message}</Text> : null}
                </View>
              </View>

              <View style={styles.actions}>
                {renderedActions.map((action) => (
                  <TouchableOpacity
                    key={action.label}
                    style={[
                      styles.actionButton,
                      actionVariants[action.variant] ?? actionVariants.ghost,
                    ]}
                    onPress={() => handleAction(action)}
                  >
                    <Text style={[styles.actionLabel, textVariants[action.variant] ?? textVariants.ghost]}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 16, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#182236',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  message: {
    marginTop: 6,
    fontSize: 14,
    color: '#C9D4E7',
    lineHeight: 20,
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'transparent',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
