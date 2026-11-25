import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/expo';

function CountdownTimer({ startTime, estimatedMinutes }: { startTime: number, estimatedMinutes: number }) {
  const [timeLeft, setTimeLeft] = useState("Calculating...");

  useEffect(() => {
    const targetTime = startTime + (estimatedMinutes * 60 * 1000);
    
    const updateTimer = () => {
      const now = Date.now();
      const difference = targetTime - now;

      if (difference <= 0) {
        setTimeLeft("Ready to collect! 🧺");
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      
      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s remaining`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s remaining`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startTime, estimatedMinutes]);

  return <Text style={styles.timerText}>{timeLeft}</Text>;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { isLoaded, isSignedIn } = useAuth(); // We added useAuth to check login status

  const allSessions = useQuery(api.sessions.getHistory, user?.id ? { userId: user.id } : "skip");

  // 1. Wait for Clerk to load
  if (!isLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // 2. If not signed in, force them to the login screen!
  if (!isSignedIn) {
    return <Redirect href="/login" />;
  }

  // 3. Wait for Convex data to load
  if (allSessions === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const activeSessions = allSessions.filter(session => session.status === 'active');

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Active Sessions</Text>
      </View>

      {activeSessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="timer-outline" size={48} color="#334155" />
          <Text style={styles.emptyText}>No active laundry sessions right now.</Text>
        </View>
      ) : (
        <FlatList
          data={activeSessions}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={styles.activeCard}>
              <View style={styles.activeCardHeader}>
                <Ionicons name="water-outline" size={20} color="#3b82f6" />
                <Text style={styles.activeCardTitle}>Drying in Progress</Text>
              </View>
              
              <CountdownTimer startTime={item.startTime} estimatedMinutes={item.estimatedMinutes} />
              
              <Text style={styles.detailText}>
                {item.garments?.length || 0} items • {item.estimatedMinutes} min total
              </Text>
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/upload')}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16', padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: '#090d16', justifyContent: 'center', alignItems: 'center' },
  headerRow: { marginBottom: 24 },
  header: { color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#64748b', marginTop: 12, fontSize: 16 },
  activeCard: { backgroundColor: '#111827', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1f2937', borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  activeCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  activeCardTitle: { color: '#94a3b8', fontSize: 14, fontWeight: '600', marginLeft: 8, textTransform: 'uppercase' },
  timerText: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  detailText: { color: '#64748b', fontSize: 14 },
  fab: { position: 'absolute', bottom: 30, right: 30, backgroundColor: '#3b82f6', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
}); 