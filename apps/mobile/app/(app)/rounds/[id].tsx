import { useState, useCallback } from 'react';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useApi, Round } from '../../../lib/api';
import { colors, spacing, borderRadius, typography } from '../../../lib/theme';

type GameType = 'NASSAU' | 'SKINS' | 'MATCH_PLAY' | 'WOLF' | 'NINES' | 'STABLEFORD' | 'BINGO_BANGO_BONGO' | 'VEGAS' | 'SNAKE' | 'BANKER';

interface Game {
  id: string;
  type: GameType;
  betAmount: string;
}

export default function RoundDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useApi();

  const [round, setRound] = useState<Round | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [betAmount, setBetAmount] = useState('5');
  const [showGameSetup, setShowGameSetup] = useState(false);

  const loadRound = async () => {
    if (!id) return;
    const result = await api.get<Round>(`/rounds/${id}`);
    if (result.success) {
      setRound(result.data);
    } else {
      Alert.alert('Error', result.error.message);
      router.back();
    }
    setLoading(false);
  };

  const loadGames = async () => {
    if (!id) return;
    const result = await api.get<Game[]>(`/games/round/${id}`);
    if (result.success && result.data) {
      setGames(result.data);
    }
  };

  const handleAddGame = async (type: GameType) => {
    if (!id) return;
    const amount = parseFloat(betAmount) || 5;

    setUpdating(true);
    const result = await api.post('/games', {
      roundId: id,
      type,
      betAmount: amount,
    });
    setUpdating(false);

    if (result.success) {
      loadGames();
      setShowGameSetup(false);
      Alert.alert('Success', `${type} game added at $${amount} per bet`);
    } else {
      Alert.alert('Error', result.error?.message || 'Failed to add game');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRound();
      loadGames();
    }, [id])
  );

  const handleCopyCode = async () => {
    if (round?.inviteCode) {
      await Clipboard.setStringAsync(round.inviteCode);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    }
  };

  const handleShare = async () => {
    if (round?.inviteCode) {
      try {
        await Share.share({
          message: `Join my golf round at ${round.course?.name}! Use code: ${round.inviteCode}`,
        });
      } catch (error) {
        // User cancelled
      }
    }
  };

  const handleStartRound = async () => {
    if (!round) return;

    Alert.alert(
      'Start Round',
      'Are you ready to start the round? Players can still join after starting.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            setUpdating(true);
            const result = await api.patch<Round>(`/rounds/${round.id}/status`, {
              status: 'ACTIVE',
            });
            if (result.success) {
              setRound(result.data);
            } else {
              Alert.alert('Error', result.error.message);
            }
            setUpdating(false);
          },
        },
      ]
    );
  };

  const handleCompleteRound = async () => {
    if (!round) return;

    Alert.alert(
      'Complete Round',
      'Are you sure you want to finish this round?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setUpdating(true);
            const result = await api.patch<Round>(`/rounds/${round.id}/status`, {
              status: 'COMPLETED',
            });
            if (result.success) {
              setRound(result.data);
            } else {
              Alert.alert('Error', result.error.message);
            }
            setUpdating(false);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (!round) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Round not found</Text>
      </View>
    );
  }

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

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: round.course?.name || 'Round',
          headerBackTitle: 'Rounds',
        }}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Round Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.courseName}>{round.course?.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(round.status) }]}>
              <Text style={styles.statusText}>
                {round.status === 'SETUP' ? 'Waiting' : round.status === 'ACTIVE' ? 'In Progress' : 'Completed'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tees:</Text>
            <Text style={styles.infoValue}>{round.tee?.name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date:</Text>
            <Text style={styles.infoValue}>
              {new Date(round.date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
        </View>

        {/* Invite Code */}
        {round.status !== 'COMPLETED' && (
          <View style={styles.inviteCard}>
            <Text style={styles.inviteTitle}>Invite Players</Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>{round.inviteCode}</Text>
              <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Text style={styles.shareButtonText}>Share Invite</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Players */}
        <View style={styles.playersCard}>
          <Text style={styles.playersTitle}>
            Players ({round.players?.length || 0}/4)
          </Text>

          {round.players?.map((player, index) => (
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
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>
                  {player.user?.displayName || player.user?.firstName || 'Unknown'}
                </Text>
                {player.courseHandicap !== null && (
                  <Text style={styles.playerHandicap}>
                    Course Handicap: {player.courseHandicap}
                  </Text>
                )}
              </View>
              {/* Calculate total score if available */}
              {player.scores && player.scores.length > 0 && (
                <View style={styles.scoreContainer}>
                  <Text style={styles.playerScore}>
                    {player.scores.reduce((sum, s) => sum + (s.strokes || 0), 0)}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Games/Bets */}
        <View style={styles.gamesCard}>
          <View style={styles.gamesHeader}>
            <Text style={styles.gamesTitle}>Games</Text>
            {round.status !== 'COMPLETED' && (
              <TouchableOpacity onPress={() => setShowGameSetup(!showGameSetup)}>
                <Text style={styles.addGameText}>
                  {showGameSetup ? 'Cancel' : '+ Add Game'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Game Setup */}
          {showGameSetup && (
            <View style={styles.gameSetup}>
              <Text style={styles.gameSetupLabel}>Bet Amount</Text>
              <View style={styles.betAmountRow}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.betAmountInput}
                  value={betAmount}
                  onChangeText={setBetAmount}
                  keyboardType="numeric"
                  placeholder="5"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
              <View style={styles.gameTypeGrid}>
                {/* Row 1 */}
                <TouchableOpacity
                  style={styles.gameTypeButton}
                  onPress={() => handleAddGame('NASSAU')}
                  disabled={updating}
                >
                  <Text style={styles.gameTypeEmoji}>🏌️</Text>
                  <Text style={styles.gameTypeText}>Nassau</Text>
                  <Text style={styles.gameTypeDesc}>Front/Back/Total</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.gameTypeButton}
                  onPress={() => handleAddGame('SKINS')}
                  disabled={updating}
                >
                  <Text style={styles.gameTypeEmoji}>💰</Text>
                  <Text style={styles.gameTypeText}>Skins</Text>
                  <Text style={styles.gameTypeDesc}>Win the hole</Text>
                </TouchableOpacity>
                {/* Row 2 */}
                <TouchableOpacity
                  style={styles.gameTypeButton}
                  onPress={() => handleAddGame('WOLF')}
                  disabled={updating}
                >
                  <Text style={styles.gameTypeEmoji}>🐺</Text>
                  <Text style={styles.gameTypeText}>Wolf</Text>
                  <Text style={styles.gameTypeDesc}>Pick partner</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.gameTypeButton}
                  onPress={() => handleAddGame('NINES')}
                  disabled={updating}
                >
                  <Text style={styles.gameTypeEmoji}>9️⃣</Text>
                  <Text style={styles.gameTypeText}>Nines</Text>
                  <Text style={styles.gameTypeDesc}>Point split</Text>
                </TouchableOpacity>
                {/* Row 3 */}
                <TouchableOpacity
                  style={styles.gameTypeButton}
                  onPress={() => handleAddGame('MATCH_PLAY')}
                  disabled={updating}
                >
                  <Text style={styles.gameTypeEmoji}>⚔️</Text>
                  <Text style={styles.gameTypeText}>Match Play</Text>
                  <Text style={styles.gameTypeDesc}>Head to head</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.gameTypeButton}
                  onPress={() => handleAddGame('STABLEFORD')}
                  disabled={updating}
                >
                  <Text style={styles.gameTypeEmoji}>📊</Text>
                  <Text style={styles.gameTypeText}>Stableford</Text>
                  <Text style={styles.gameTypeDesc}>Points system</Text>
                </TouchableOpacity>
                {/* Row 4 */}
                <TouchableOpacity
                  style={styles.gameTypeButton}
                  onPress={() => handleAddGame('BINGO_BANGO_BONGO')}
                  disabled={updating}
                >
                  <Text style={styles.gameTypeEmoji}>🎯</Text>
                  <Text style={styles.gameTypeText}>Bingo Bango</Text>
                  <Text style={styles.gameTypeDesc}>3 pts per hole</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.gameTypeButton}
                  onPress={() => handleAddGame('VEGAS')}
                  disabled={updating}
                >
                  <Text style={styles.gameTypeEmoji}>🎰</Text>
                  <Text style={styles.gameTypeText}>Vegas</Text>
                  <Text style={styles.gameTypeDesc}>2v2 teams</Text>
                </TouchableOpacity>
                {/* Row 5 */}
                <TouchableOpacity
                  style={styles.gameTypeButton}
                  onPress={() => handleAddGame('SNAKE')}
                  disabled={updating}
                >
                  <Text style={styles.gameTypeEmoji}>🐍</Text>
                  <Text style={styles.gameTypeText}>Snake</Text>
                  <Text style={styles.gameTypeDesc}>3-putt penalty</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.gameTypeButton}
                  onPress={() => handleAddGame('BANKER')}
                  disabled={updating}
                >
                  <Text style={styles.gameTypeEmoji}>🏦</Text>
                  <Text style={styles.gameTypeText}>Banker</Text>
                  <Text style={styles.gameTypeDesc}>Bank the hole</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Active Games */}
          {games.length > 0 ? (
            <View style={styles.activeGames}>
              {games.map((game) => (
                <View key={game.id} style={styles.gameRow}>
                  <View style={styles.gameInfo}>
                    <Text style={styles.gameType}>{game.type}</Text>
                    <Text style={styles.gameBet}>${parseFloat(game.betAmount).toFixed(0)}/bet</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : !showGameSetup && (
            <Text style={styles.noGamesText}>No games set up yet</Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {round.status === 'SETUP' && (
            <TouchableOpacity
              style={[styles.primaryButton, updating && styles.buttonDisabled]}
              onPress={handleStartRound}
              disabled={updating}
            >
              <Text style={styles.primaryButtonText}>
                {updating ? 'Starting...' : 'Start Round'}
              </Text>
            </TouchableOpacity>
          )}

          {round.status === 'ACTIVE' && (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push(`/rounds/${round.id}/scorecard`)}
              >
                <Text style={styles.primaryButtonText}>Open Scorecard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, updating && styles.buttonDisabled]}
                onPress={handleCompleteRound}
                disabled={updating}
              >
                <Text style={styles.secondaryButtonText}>
                  {updating ? 'Completing...' : 'Complete Round'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {round.status === 'COMPLETED' && (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push(`/rounds/${round.id}/settlement`)}
              >
                <Text style={styles.primaryButtonText}>View Settlement</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push(`/rounds/${round.id}/scorecard`)}
              >
                <Text style={styles.secondaryButtonText}>View Scorecard</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Settlement link for active rounds with games */}
          {round.status === 'ACTIVE' && games.length > 0 && (
            <TouchableOpacity
              style={styles.settlementLink}
              onPress={() => router.push(`/rounds/${round.id}/settlement`)}
            >
              <Text style={styles.settlementLinkText}>View Live Standings</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
  errorText: {
    color: '#EF4444',
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  courseName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#9CA3AF',
    fontSize: 15,
    width: 60,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  inviteCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  inviteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  codeText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'monospace',
    paddingLeft: 12,
  },
  copyButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
  },
  playersCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  playersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  playerHandicap: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  scoreContainer: {
    backgroundColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  playerScore: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actions: {
    marginTop: 8,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Games Section
  gamesCard: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  gamesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gamesTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  addGameText: {
    ...typography.captionBold,
    color: colors.brand.primary,
  },
  gameSetup: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  gameSetupLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  betAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  dollarSign: {
    ...typography.h2,
    color: colors.brand.primary,
  },
  betAmountInput: {
    flex: 1,
    ...typography.h2,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  gameTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gameTypeButton: {
    width: '48%',
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  gameTypeEmoji: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  gameTypeText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  gameTypeDesc: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  activeGames: {
    gap: spacing.sm,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  gameInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  gameType: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  gameBet: {
    ...typography.caption,
    color: colors.brand.accent,
  },
  noGamesText: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  settlementLink: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  settlementLinkText: {
    ...typography.captionBold,
    color: colors.brand.accent,
  },
});
