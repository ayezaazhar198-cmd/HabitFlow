import { Tabs } from 'expo-router';
import Lucide from '@react-native-vector-icons/lucide';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

export default function MainTabLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="today"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accentStrong,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            height: 78 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, 10),
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: theme.mode === 'light' ? 0.06 : 0.18,
            shadowRadius: 12,
            elevation: 12,
          },
        ],
        tabBarActiveBackgroundColor: theme.colors.accentSoft,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarAccessibilityLabel: 'Today tab',
          tabBarIcon: ({ color, focused }) => (
            <Lucide name="house" color={color} size={focused ? 22 : 20} />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Statistics',
          tabBarAccessibilityLabel: 'Statistics tab',
          tabBarIcon: ({ color, focused }) => (
            <Lucide name="chart-no-axes-column-increasing" color={color} size={focused ? 22 : 20} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarAccessibilityLabel: 'History tab',
          tabBarIcon: ({ color, focused }) => (
            <Lucide name="calendar-days" color={color} size={focused ? 22 : 20} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings tab',
          tabBarIcon: ({ color, focused }) => (
            <Lucide name="settings-2" color={color} size={focused ? 22 : 20} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  tabBarItem: {
    minHeight: 58,
    marginHorizontal: 4,
    marginVertical: 2,
    borderRadius: 999,
  },
});
