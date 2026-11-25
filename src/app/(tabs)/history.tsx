import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator } from 'react-native';
import { useQuery } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../convex/_generated/api';
import { useUser } from '@clerk/expo';

export default function HistoryScreen() {
  const { user } = useUser();
  const sessions = useQuery(api.sessions.getHistory, user?.id ? { userId: user.id } : "skip");

  if (sessions === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const renderItem = ({ item }: { item: any }) => {
    const date = new Date(item.startTime).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
      <View style={styles.card}>
        <Image source={{ uri: item.imageUrl }} style={styles.thumbnail} />
        <View style={styles.cardContent}>
          <Text style={styles.dateText}>{date}</Text>
          <Text style={styles.detailText}>
            <Ionicons name="shirt" size={14} color="#94a3b8" /> {item.garments?.length || 0} items
          </Text>
          <View style={styles.timeBadge}>
            <Ionicons name="time" size={14} color="#34d399" />
            <Text style={styles.timeText}>{item.estimatedMinutes} mins</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>History</Text>
      
      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#334155" />
          <Text style={styles.emptyText}>No past sessions found.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16', paddingHorizontal: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: '#090d16', justifyContent: 'center', alignItems: 'center' },
  header: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 20 },
  listContainer: { paddingBottom: 100 },
  card: { backgroundColor: '#111827', borderRadius: 16, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1f2937' },
  thumbnail: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#1e293b' },
  cardContent: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  dateText: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  detailText: { color: '#94a3b8', fontSize: 14, marginBottom: 8 },
  timeBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  timeText: { color: '#34d399', fontSize: 13, fontWeight: '700', marginLeft: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#64748b', marginTop: 12, fontSize: 16 },
}); 