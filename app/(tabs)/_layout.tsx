import React from 'react';
import { Tabs } from 'expo-router';
import { Home, HandCoins, ArrowLeftRight, LayoutGrid } from 'lucide-react-native';
import { FloatingTabBar } from '../../src/components/navigation/FloatingTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size || 22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: 'Credit',
          tabBarIcon: ({ color, size }) => <HandCoins size={size || 22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => <ArrowLeftRight size={size || 22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <LayoutGrid size={size || 22} color={color} />,
        }}
      />
    </Tabs>
  );
}
