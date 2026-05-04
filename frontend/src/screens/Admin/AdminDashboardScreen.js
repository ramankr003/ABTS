import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAdminStats } from '../../store/adminSlice';
import Card from '../../components/common/Card';
import { Colors, Spacing, Typography } from '../../theme';

export default function AdminDashboardScreen({ navigation }) {
  const dispatch = useDispatch();
  const { stats, isLoading } = useSelector((s) => s.admin);

  useEffect(() => {
    dispatch(fetchAdminStats());
  }, [dispatch]);

  const StatBox = ({ title, value, icon, color }) => (
    <Card shadow="light" style={styles.statBox}>
      <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
        <MaterialCommunityIcons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.statValue}>{value ?? '-'}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => dispatch(fetchAdminStats())} />}
      >
        <Text style={styles.sectionTitle}>Overview</Text>
        
        <View style={styles.row}>
          <StatBox title="Total Users" value={stats?.totalUsers} icon="account-group" color={Colors.primary} />
          <StatBox title="Total Drivers" value={stats?.totalDrivers} icon="steering" color={Colors.secondary} />
        </View>
        <View style={styles.row}>
          <StatBox title="Available Ambulances" value={stats?.availableAmbulances} icon="ambulance" color={Colors.success} />
          <StatBox title="Bookings Today" value={stats?.bookingsToday} icon="clipboard-pulse" color={Colors.error} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.white },
  container: { padding: Spacing.md },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: Spacing.lg },
  iconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  statTitle: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
});
