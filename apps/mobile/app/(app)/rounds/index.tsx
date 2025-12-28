import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useApi, Round } from '../../../lib/api';

export default function RoundsScreen() {
  const router = useRouter();
  const api = useApi();

  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRounds = async () => {
    const result = await api.get<Round[]>('/rounds');
    if (result.success) {
      setRounds(result.data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadRounds();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadRounds();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SETUP':
        return '#F59E0B';
      case 'ACTIVE':
        return '#10B981';
      case 'COMPLETED':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SETUP':
        return 'Waiting';
      case 'ACTIVE':
        return 'In Progress';
      case 'COMPLETED':
        return 'Completed';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderRound = ({ item }: { item: Round }) => (
    <TouchableOpacity
      style={styles.roundCard}
      onPress={() => router.push(`/rounds/${item.id}`)}
    >
      <View style={styles.roundHeader}>
        <Text style={styles.courseName}>{item.course?.name || 'Unknown Course'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      <View style={styles.roundDetails}>
        <Text style={styles.dateText}>{formatDate(item.date)}</Text>
        <Text style={styles.teeText}>{item.tee?.name} Tees</Text>
      </View>

      <View style={styles.playersRow}>
        {item.players?.slice(0, 4).map((player, index) => (
          <View
            key={player.id}
            style={[
              styles.playerAvatar,
              { marginLeft: index > 0 ? -8 : 0 },
              { backgroundColor: `hsl(${(index * 90) % 360}, 60%, 50%)` },
            ]}
          >
            <Text style={styles.playerInitial}>
              {player.user?.displayName?.[0] || player.user?.firstName?.[0] || '?'}
            </Text>
          </View>
        ))}
        <Text style={styles.playerCount}>
          {item.players?.length || 0} player{(item.players?.length || 0) !== 1 ? 's' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Rounds',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/rounds/new')}>
              <Text style={styles.addButton}>+ New</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {rounds.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Rounds Yet</Text>
          <Text style={styles.emptySubtitle}>Start a new round to track scores with your group</Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => router.push('/rounds/new')}
          >
            <Text style={styles.startButtonText}>Start a Round</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rounds}
          keyExtractor={(item) => item.id}
          renderItem={renderRound}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  list: {
    padding: 16,
  },
  addButton: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
  },
  roundCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  courseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  roundDetails: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dateText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginRight: 16,
  },
  teeText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1F2937',
  },
  playerInitial: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  playerCount: {
    color: '#6B7280',
    fontSize: 14,
    marginLeft: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
