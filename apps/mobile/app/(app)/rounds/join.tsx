import { useState } from 'react';
import { useRouter, Stack } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useApi, Round } from '../../../lib/api';

export default function JoinRoundScreen() {
  const router = useRouter();
  const api = useApi();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [previewRound, setPreviewRound] = useState<Round | null>(null);

  const handlePreview = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setLoading(true);
    const result = await api.get<Round>(`/rounds/join/${code.trim()}`);
    setLoading(false);

    if (result.success) {
      setPreviewRound(result.data);
    } else {
      Alert.alert('Error', result.error.message);
    }
  };

  const handleJoin = async () => {
    if (!previewRound) return;

    setJoining(true);
    const result = await api.post<Round>('/rounds/join', {
      inviteCode: code.trim(),
    });
    setJoining(false);

    if (result.success) {
      router.replace(`/rounds/${result.data.id}`);
    } else {
      Alert.alert('Error', result.error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen
        options={{
          title: 'Join Round',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.content}>
        {!previewRound ? (
          <>
            <Text style={styles.title}>Enter Invite Code</Text>
            <Text style={styles.subtitle}>
              Get the invite code from the round creator
            </Text>

            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="Enter code"
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handlePreview}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Find Round</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Round Found!</Text>

              <View style={styles.previewInfo}>
                <Text style={styles.previewCourse}>{previewRound.course?.name}</Text>
                <Text style={styles.previewDetails}>
                  {previewRound.tee?.name} Tees • {previewRound.players?.length || 0} players
                </Text>
                <Text style={styles.previewDate}>
                  {new Date(previewRound.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </View>

              <View style={styles.playersPreview}>
                <Text style={styles.playersLabel}>Current Players:</Text>
                {previewRound.players?.map((player, index) => (
                  <View key={player.id} style={styles.playerRow}>
                    <View
                      style={[
                        styles.playerAvatar,
                        { backgroundColor: `hsl(${(index * 90) % 360}, 60%, 50%)` },
                      ]}
                    >
                      <Text style={styles.playerInitial}>
                        {player.user?.displayName?.[0] || player.user?.firstName?.[0] || '?'}
                      </Text>
                    </View>
                    <Text style={styles.playerName}>
                      {player.user?.displayName || player.user?.firstName || 'Unknown'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, joining && styles.buttonDisabled]}
              onPress={handleJoin}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Join This Round</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setPreviewRound(null);
                setCode('');
              }}
            >
              <Text style={styles.secondaryButtonText}>Try Different Code</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  cancelButton: {
    color: '#10B981',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 18,
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  previewCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 16,
  },
  previewInfo: {
    marginBottom: 20,
  },
  previewCourse: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  previewDetails: {
    fontSize: 15,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  previewDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  playersPreview: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 16,
  },
  playersLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerInitial: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 15,
    marginLeft: 12,
  },
  secondaryButton: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
