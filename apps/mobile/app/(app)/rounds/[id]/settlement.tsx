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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { useApi } from '../../../../lib/api';
import { colors, spacing, borderRadius, typography } from '../../../../lib/theme';

interface Settlement {
  id: string;
  amount: string;
  status: 'PENDING' | 'PAID' | 'DISPUTED';
  fromUser: {
    id: string;
    displayName: string | null;
    firstName: string | null;
    paymentMethods: Array<{
      type: string;
      handle: string;
      isPreferred: boolean;
    }>;
  };
  toUser: {
    id: string;
    displayName: string | null;
    firstName: string | null;
    paymentMethods: Array<{
      type: string;
      handle: string;
      isPreferred: boolean;
    }>;
  };
}

interface GameResult {
  nassau?: {
    front: { winnerId: string | null; margin: number; status: string };
    back: { winnerId: string | null; margin: number; status: string };
    overall: { winnerId: string | null; margin: number; status: string };
    betAmount: number;
  };
  skins?: {
    skins: Array<{ hole: number; winnerId: string | null; value: number }>;
    totalPot: number;
  };
  wolf?: {
    standings: Array<{ userId: string; name: string; points: number }>;
    betAmount: number;
  };
  nines?: {
    standings: Array<{
      userId: string;
      name: string;
      front: number;
      back: number;
      total: number;
      totalMoney: number;
    }>;
    betAmount: number;
  };
  matchPlay?: {
    standings: Array<{ userId: string; name: string; status: string; money: number }>;
    matchStatus: string;
    betAmount: number;
  };
  stableford?: {
    standings: Array<{
      userId: string;
      name: string;
      front: number;
      back: number;
      total: number;
      money: number;
    }>;
    betAmount: number;
  };
  bingoBangoBongo?: {
    standings: Array<{
      userId: string;
      name: string;
      bingo: number;
      bango: number;
      bongo: number;
      total: number;
      money: number;
    }>;
    betAmount: number;
  };
  vegas?: {
    teams: Array<{
      teamNumber: number;
      players: string[];
      totalDiff: number;
      money: number;
    }>;
    betAmount: number;
  };
  snake?: {
    snakeHolderName: string | null;
    standings: Array<{
      userId: string;
      name: string;
      threePutts: number;
      holdsSnake: boolean;
      money: number;
    }>;
    betAmount: number;
  };
  banker?: {
    standings: Array<{ userId: string; name: string; money: number }>;
    betAmount: number;
  };
}

export default function SettlementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useApi();
  const { user } = useUser();

  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [gameResults, setGameResults] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const loadData = async () => {
    if (!id) return;

    setLoading(true);

    // Load game calculations
    const calcResult = await api.get<{ results: GameResult }>(`/games/${id}/calculate`);
    if (calcResult.success && calcResult.data) {
      setGameResults(calcResult.data.results);
    }

    // Load settlements
    const settleResult = await api.get<Settlement[]>(`/games/settlements/${id}`);
    if (settleResult.success && settleResult.data) {
      setSettlements(settleResult.data);
    }

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const handleFinalize = async () => {
    if (!id) return;

    Alert.alert(
      'Finalize Round',
      'This will calculate final settlements and mark the round as complete. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalize',
          onPress: async () => {
            setProcessing(true);
            const result = await api.post(`/games/${id}/finalize`);
            setProcessing(false);

            if (result.success) {
              loadData();
              Alert.alert('Success', 'Round finalized! Settlements have been calculated.');
            } else {
              Alert.alert('Error', result.error?.message || 'Failed to finalize round');
            }
          },
        },
      ]
    );
  };

  const handlePay = async (settlement: Settlement) => {
    const recipient = settlement.toUser;
    const amount = parseFloat(settlement.amount);

    // Find preferred payment method
    const preferred = recipient.paymentMethods.find(p => p.isPreferred);
    const paymentMethod = preferred || recipient.paymentMethods[0];

    if (!paymentMethod) {
      Alert.alert('No Payment Method', `${recipient.firstName || recipient.displayName} hasn't set up a payment method.`);
      return;
    }

    let paymentUrl = '';
    const note = encodeURIComponent(`Press Golf - Round settlement`);

    switch (paymentMethod.type) {
      case 'VENMO':
        // Venmo deep link with pre-filled info
        paymentUrl = `venmo://paycharge?txn=pay&recipients=${paymentMethod.handle}&amount=${amount}&note=${note}`;
        break;
      case 'CASHAPP':
        // CashApp URL scheme
        paymentUrl = `cashapp://cash.app/$${paymentMethod.handle}`;
        break;
      case 'ZELLE':
        // Zelle doesn't have a deep link, just copy info
        Alert.alert(
          'Pay via Zelle',
          `Send $${amount.toFixed(2)} to:\n\n${paymentMethod.handle}\n\nNote: Press Golf settlement`,
          [{ text: 'OK' }]
        );
        return;
      default:
        Alert.alert('Payment', `Pay $${amount.toFixed(2)} to ${recipient.firstName || recipient.displayName}`);
        return;
    }

    try {
      const supported = await Linking.canOpenURL(paymentUrl);
      if (supported) {
        await Linking.openURL(paymentUrl);
      } else {
        Alert.alert('App Not Found', `Please install ${paymentMethod.type} to pay directly.`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open payment app');
    }
  };

  const handleMarkPaid = async (settlementId: string) => {
    const result = await api.patch(`/games/settlements/${settlementId}/paid`);
    if (result.success) {
      loadData();
    } else {
      Alert.alert('Error', 'Failed to mark as paid');
    }
  };

  const getPlayerName = (player: { displayName: string | null; firstName: string | null }) => {
    return player.displayName || player.firstName || 'Unknown';
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  const mySettlementsOwed = settlements.filter(s => s.fromUser.id === user?.id && s.status === 'PENDING');
  const mySettlementsReceiving = settlements.filter(s => s.toUser.id === user?.id && s.status === 'PENDING');
  const totalOwed = mySettlementsOwed.reduce((sum, s) => sum + parseFloat(s.amount), 0);
  const totalReceiving = mySettlementsReceiving.reduce((sum, s) => sum + parseFloat(s.amount), 0);
  const netAmount = totalReceiving - totalOwed;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Settlement',
          headerStyle: { backgroundColor: colors.background.primary },
          headerTintColor: colors.text.primary,
        }}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Net Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Your Net</Text>
          <Text style={[
            styles.summaryAmount,
            netAmount >= 0 ? styles.amountPositive : styles.amountNegative
          ]}>
            {netAmount >= 0 ? '+' : '-'}${Math.abs(netAmount).toFixed(2)}
          </Text>
          <Text style={styles.summarySubtext}>
            {netAmount > 0 ? 'You\'re collecting' : netAmount < 0 ? 'You owe' : 'All square'}
          </Text>
        </View>

        {/* Game Results */}
        {gameResults?.nassau && (
          <View style={styles.gameCard}>
            <Text style={styles.gameTitle}>Nassau Results</Text>
            <View style={styles.gameRow}>
              <Text style={styles.gameLabel}>Front 9</Text>
              <Text style={styles.gameValue}>{gameResults.nassau.front.status}</Text>
            </View>
            <View style={styles.gameRow}>
              <Text style={styles.gameLabel}>Back 9</Text>
              <Text style={styles.gameValue}>{gameResults.nassau.back.status}</Text>
            </View>
            <View style={styles.gameRow}>
              <Text style={styles.gameLabel}>Overall</Text>
              <Text style={styles.gameValue}>{gameResults.nassau.overall.status}</Text>
            </View>
            <View style={styles.gameBet}>
              <Text style={styles.gameBetText}>
                ${gameResults.nassau.betAmount} per bet × 3 bets
              </Text>
            </View>
          </View>
        )}

        {gameResults?.skins && (
          <View style={styles.gameCard}>
            <Text style={styles.gameTitle}>Skins Results</Text>
            <Text style={styles.skinsTotal}>
              Total Pot: ${gameResults.skins.totalPot.toFixed(2)}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.skinsRow}>
                {gameResults.skins.skins.filter(s => s.winnerId).slice(0, 9).map((skin) => (
                  <View key={skin.hole} style={styles.skinBadge}>
                    <Text style={styles.skinHole}>#{skin.hole}</Text>
                    <Text style={styles.skinValue}>${skin.value}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {gameResults?.wolf && (
          <View style={styles.gameCard}>
            <Text style={styles.gameTitle}>Wolf Standings</Text>
            {gameResults.wolf.standings.map((player, index) => (
              <View key={player.userId} style={styles.standingRow}>
                <View style={styles.standingRank}>
                  <Text style={styles.standingRankText}>{index + 1}</Text>
                </View>
                <Text style={styles.standingName}>{player.name}</Text>
                <Text style={[
                  styles.standingPoints,
                  player.points >= 0 ? styles.amountPositive : styles.amountNegative
                ]}>
                  {player.points >= 0 ? '+' : ''}${player.points.toFixed(0)}
                </Text>
              </View>
            ))}
            <View style={styles.gameBet}>
              <Text style={styles.gameBetText}>
                ${gameResults.wolf.betAmount} per hole
              </Text>
            </View>
          </View>
        )}

        {gameResults?.nines && (
          <View style={styles.gameCard}>
            <Text style={styles.gameTitle}>Nines Standings</Text>
            {gameResults.nines.standings.map((player, index) => (
              <View key={player.userId} style={styles.ninesRow}>
                <View style={styles.standingRank}>
                  <Text style={styles.standingRankText}>{index + 1}</Text>
                </View>
                <View style={styles.ninesInfo}>
                  <Text style={styles.standingName}>{player.name}</Text>
                  <Text style={styles.ninesPoints}>
                    F: {player.front.toFixed(1)} | B: {player.back.toFixed(1)} | T: {player.total.toFixed(1)}
                  </Text>
                </View>
                <Text style={[
                  styles.standingPoints,
                  player.totalMoney >= 0 ? styles.amountPositive : styles.amountNegative
                ]}>
                  {player.totalMoney >= 0 ? '+' : ''}${player.totalMoney.toFixed(2)}
                </Text>
              </View>
            ))}
            <View style={styles.gameBet}>
              <Text style={styles.gameBetText}>
                ${gameResults.nines.betAmount} per point
              </Text>
            </View>
          </View>
        )}

        {gameResults?.matchPlay && (
          <View style={styles.gameCard}>
            <Text style={styles.gameTitle}>Match Play</Text>
            <Text style={styles.matchStatus}>{gameResults.matchPlay.matchStatus}</Text>
            {gameResults.matchPlay.standings.map((player, index) => (
              <View key={player.userId} style={styles.standingRow}>
                <Text style={styles.standingName}>{player.name}</Text>
                <Text style={styles.matchPlayStatus}>{player.status}</Text>
                <Text style={[
                  styles.standingPoints,
                  player.money >= 0 ? styles.amountPositive : styles.amountNegative
                ]}>
                  {player.money >= 0 ? '+' : ''}${Math.abs(player.money).toFixed(0)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {gameResults?.stableford && (
          <View style={styles.gameCard}>
            <Text style={styles.gameTitle}>Stableford</Text>
            {gameResults.stableford.standings.map((player, index) => (
              <View key={player.userId} style={styles.ninesRow}>
                <View style={styles.standingRank}>
                  <Text style={styles.standingRankText}>{index + 1}</Text>
                </View>
                <View style={styles.ninesInfo}>
                  <Text style={styles.standingName}>{player.name}</Text>
                  <Text style={styles.ninesPoints}>
                    {player.total} pts
                  </Text>
                </View>
                <Text style={[
                  styles.standingPoints,
                  player.money >= 0 ? styles.amountPositive : styles.amountNegative
                ]}>
                  {player.money >= 0 ? '+' : ''}${player.money.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {gameResults?.bingoBangoBongo && (
          <View style={styles.gameCard}>
            <Text style={styles.gameTitle}>Bingo Bango Bongo</Text>
            {gameResults.bingoBangoBongo.standings.map((player, index) => (
              <View key={player.userId} style={styles.ninesRow}>
                <View style={styles.standingRank}>
                  <Text style={styles.standingRankText}>{index + 1}</Text>
                </View>
                <View style={styles.ninesInfo}>
                  <Text style={styles.standingName}>{player.name}</Text>
                  <Text style={styles.ninesPoints}>
                    🎯{player.bingo} 📍{player.bango} ⛳{player.bongo}
                  </Text>
                </View>
                <Text style={[
                  styles.standingPoints,
                  player.money >= 0 ? styles.amountPositive : styles.amountNegative
                ]}>
                  {player.money >= 0 ? '+' : ''}${player.money.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {gameResults?.vegas && (
          <View style={styles.gameCard}>
            <Text style={styles.gameTitle}>Vegas</Text>
            {gameResults.vegas.teams.map((team) => (
              <View key={team.teamNumber} style={styles.vegasTeam}>
                <Text style={styles.vegasTeamName}>
                  Team {team.teamNumber}: {team.players.join(' & ')}
                </Text>
                <Text style={[
                  styles.standingPoints,
                  team.money >= 0 ? styles.amountPositive : styles.amountNegative
                ]}>
                  {team.money >= 0 ? '+' : ''}${team.money.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {gameResults?.snake && (
          <View style={styles.gameCard}>
            <Text style={styles.gameTitle}>Snake</Text>
            {gameResults.snake.snakeHolderName && (
              <Text style={styles.snakeHolder}>
                🐍 {gameResults.snake.snakeHolderName} holds the snake
              </Text>
            )}
            {gameResults.snake.standings.map((player) => (
              <View key={player.userId} style={styles.standingRow}>
                <Text style={styles.standingName}>
                  {player.holdsSnake ? '🐍 ' : ''}{player.name}
                </Text>
                <Text style={styles.ninesPoints}>{player.threePutts} 3-putts</Text>
                <Text style={[
                  styles.standingPoints,
                  player.money >= 0 ? styles.amountPositive : styles.amountNegative
                ]}>
                  {player.money >= 0 ? '+' : ''}${Math.abs(player.money).toFixed(0)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {gameResults?.banker && (
          <View style={styles.gameCard}>
            <Text style={styles.gameTitle}>Banker</Text>
            {gameResults.banker.standings.map((player, index) => (
              <View key={player.userId} style={styles.standingRow}>
                <View style={styles.standingRank}>
                  <Text style={styles.standingRankText}>{index + 1}</Text>
                </View>
                <Text style={styles.standingName}>{player.name}</Text>
                <Text style={[
                  styles.standingPoints,
                  player.money >= 0 ? styles.amountPositive : styles.amountNegative
                ]}>
                  {player.money >= 0 ? '+' : ''}${player.money.toFixed(0)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Settlements You Owe */}
        {mySettlementsOwed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>You Owe</Text>
            {mySettlementsOwed.map((settlement) => (
              <View key={settlement.id} style={styles.settlementCard}>
                <View style={styles.settlementInfo}>
                  <View style={styles.settlementAvatar}>
                    <Text style={styles.settlementAvatarText}>
                      {getPlayerName(settlement.toUser)[0]}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.settlementName}>
                      {getPlayerName(settlement.toUser)}
                    </Text>
                    <Text style={styles.settlementAmount}>
                      ${parseFloat(settlement.amount).toFixed(2)}
                    </Text>
                  </View>
                </View>
                <View style={styles.settlementActions}>
                  <TouchableOpacity
                    style={styles.payButton}
                    onPress={() => handlePay(settlement)}
                  >
                    <Text style={styles.payButtonText}>Pay</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.paidButton}
                    onPress={() => handleMarkPaid(settlement.id)}
                  >
                    <Text style={styles.paidButtonText}>Mark Paid</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Settlements You're Receiving */}
        {mySettlementsReceiving.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Collecting From</Text>
            {mySettlementsReceiving.map((settlement) => (
              <View key={settlement.id} style={styles.settlementCard}>
                <View style={styles.settlementInfo}>
                  <View style={[styles.settlementAvatar, styles.settlementAvatarReceiving]}>
                    <Text style={styles.settlementAvatarText}>
                      {getPlayerName(settlement.fromUser)[0]}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.settlementName}>
                      {getPlayerName(settlement.fromUser)}
                    </Text>
                    <Text style={[styles.settlementAmount, styles.amountPositive]}>
                      +${parseFloat(settlement.amount).toFixed(2)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => handleMarkPaid(settlement.id)}
                >
                  <Text style={styles.confirmButtonText}>Confirm Paid</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* No settlements yet */}
        {settlements.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No settlements yet. Finalize the round to calculate who owes whom.
            </Text>
            <TouchableOpacity
              style={styles.finalizeButton}
              onPress={handleFinalize}
              disabled={processing}
            >
              <Text style={styles.finalizeButtonText}>
                {processing ? 'Processing...' : 'Finalize Round'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  summaryAmount: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  amountPositive: {
    color: colors.brand.primary,
  },
  amountNegative: {
    color: colors.functional.error,
  },
  summarySubtext: {
    ...typography.body,
    color: colors.text.secondary,
  },

  // Game Card
  gameCard: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  gameTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  gameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  gameLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  gameValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  gameBet: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  gameBetText: {
    ...typography.caption,
    color: colors.brand.accent,
    textAlign: 'center',
  },

  // Skins
  skinsTotal: {
    ...typography.bodyBold,
    color: colors.brand.primary,
    marginBottom: spacing.md,
  },
  skinsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  skinBadge: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    minWidth: 60,
  },
  skinHole: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  skinValue: {
    ...typography.captionBold,
    color: colors.brand.primary,
  },

  // Wolf & Nines Standings
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  standingRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  standingRankText: {
    ...typography.captionBold,
    color: colors.text.secondary,
  },
  standingName: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  standingPoints: {
    ...typography.h3,
    minWidth: 70,
    textAlign: 'right',
  },
  ninesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  ninesInfo: {
    flex: 1,
  },
  ninesPoints: {
    ...typography.label,
    color: colors.text.tertiary,
    marginTop: 2,
  },

  // Match Play
  matchStatus: {
    ...typography.bodyBold,
    color: colors.brand.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  matchPlayStatus: {
    ...typography.caption,
    color: colors.text.secondary,
    marginRight: spacing.md,
  },

  // Vegas
  vegasTeam: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  vegasTeamName: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },

  // Snake
  snakeHolder: {
    ...typography.bodyBold,
    color: colors.functional.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  // Section
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },

  // Settlement Card
  settlementCard: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  settlementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settlementAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.functional.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settlementAvatarReceiving: {
    backgroundColor: colors.brand.primary,
  },
  settlementAvatarText: {
    ...typography.h3,
    color: colors.text.primary,
  },
  settlementName: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  settlementAmount: {
    ...typography.h3,
    color: colors.functional.error,
  },
  settlementActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  payButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  payButtonText: {
    ...typography.captionBold,
    color: colors.text.primary,
  },
  paidButton: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  paidButtonText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  confirmButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  confirmButtonText: {
    ...typography.captionBold,
    color: colors.text.primary,
  },

  // Empty State
  emptyState: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  finalizeButton: {
    backgroundColor: colors.brand.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  finalizeButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
});
