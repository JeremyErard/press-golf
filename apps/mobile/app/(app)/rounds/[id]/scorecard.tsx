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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApi, Round } from '../../../../lib/api';
import { colors, spacing, borderRadius, typography } from '../../../../lib/theme';

interface HoleData {
  holeNumber: number;
  par: number;
  handicapRank: number;
  yardage?: number;
}

const { width } = Dimensions.get('window');
const HOLE_BUTTON_SIZE = 36;

export default function ScorecardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useApi();

  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentHole, setCurrentHole] = useState(1);
  const [saving, setSaving] = useState(false);

  // Local scores state for optimistic updates
  const [localScores, setLocalScores] = useState<Record<string, Record<number, number | null>>>({});

  const loadRound = async () => {
    if (!id) return;
    const result = await api.get<Round>(`/rounds/${id}`);
    if (result.success) {
      setRound(result.data);

      // Initialize local scores from server data
      const scores: Record<string, Record<number, number | null>> = {};
      result.data.players?.forEach((player) => {
        scores[player.id] = {};
        player.scores?.forEach((score) => {
          scores[player.id][score.holeNumber] = score.strokes;
        });
      });
      setLocalScores(scores);
    } else {
      Alert.alert('Error', result.error.message);
      router.back();
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadRound();
    }, [id])
  );

  const getHoles = (): HoleData[] => {
    if (!round?.course?.holes) {
      return Array.from({ length: 18 }, (_, i) => ({
        holeNumber: i + 1,
        par: 4,
        handicapRank: i + 1,
      }));
    }

    return round.course.holes.map((hole) => ({
      holeNumber: hole.holeNumber,
      par: hole.par,
      handicapRank: hole.handicapRank,
      yardage: hole.yardages?.find((y) => y.tee?.id === round.teeId)?.yardage,
    }));
  };

  const holes = round ? getHoles() : [];
  const currentHoleData = holes.find((h) => h.holeNumber === currentHole);

  const handleScoreChange = async (playerId: string, strokes: number | null) => {
    if (!round || round.status !== 'ACTIVE') return;

    // Optimistic update
    setLocalScores((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [currentHole]: strokes,
      },
    }));

    // Save to server
    setSaving(true);
    const result = await api.post(`/rounds/${round.id}/scores`, {
      playerId,
      holeNumber: currentHole,
      strokes,
    });
    setSaving(false);

    if (!result.success) {
      Alert.alert('Error', 'Failed to save score');
      loadRound();
    }
  };

  const getPlayerScore = (playerId: string, holeNum: number): number | null => {
    return localScores[playerId]?.[holeNum] ?? null;
  };

  const getTotalScore = (playerId: string): number => {
    const playerScores = localScores[playerId] || {};
    return Object.values(playerScores).reduce((sum: number, s) => sum + (s || 0), 0);
  };

  const getHolesPlayed = (playerId: string): number => {
    const playerScores = localScores[playerId] || {};
    return Object.values(playerScores).filter((s) => s !== null).length;
  };

  const getTotalPar = (holesPlayed: number): number => {
    return holes.slice(0, holesPlayed).reduce((sum, h) => sum + h.par, 0);
  };

  const getScoreToPar = (playerId: string): string => {
    const holesPlayed = getHolesPlayed(playerId);
    if (holesPlayed === 0) return 'E';
    const total = getTotalScore(playerId);
    const par = getTotalPar(holesPlayed);
    const diff = total - par;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const getScoreLabel = (strokes: number | null, par: number): string => {
    if (strokes === null) return '';
    const diff = strokes - par;
    if (diff <= -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0) return 'Par';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Double';
    return `+${diff}`;
  };

  const getScoreStyle = (strokes: number | null, par: number) => {
    if (strokes === null) return { bg: colors.background.elevated, text: colors.text.tertiary };
    const diff = strokes - par;
    if (diff <= -2) return { bg: '#1E40AF', text: '#FFFFFF' }; // Eagle - deep blue
    if (diff === -1) return { bg: colors.functional.error, text: '#FFFFFF' }; // Birdie - red circle
    if (diff === 0) return { bg: colors.background.surface, text: colors.text.primary, border: colors.border.default }; // Par
    if (diff === 1) return { bg: colors.background.surface, text: colors.text.secondary, border: colors.border.default }; // Bogey
    return { bg: colors.background.elevated, text: colors.text.tertiary }; // Double+
  };

  const isHoleComplete = (holeNum: number): boolean => {
    return round?.players?.every((p) => getPlayerScore(p.id, holeNum) !== null) ?? false;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
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

  const isEditable = round.status === 'ACTIVE';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: round.course?.name || 'Scorecard',
          headerStyle: { backgroundColor: colors.background.primary },
          headerTintColor: colors.text.primary,
          headerBackTitle: 'Round',
        }}
      />

      {/* Hole Selector - Horizontal scrolling 1-18 */}
      <View style={styles.holeSelector}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.holeSelectorContent}
        >
          {holes.map((hole) => {
            const isActive = currentHole === hole.holeNumber;
            const isComplete = isHoleComplete(hole.holeNumber);

            return (
              <TouchableOpacity
                key={hole.holeNumber}
                style={[
                  styles.holeButton,
                  isActive && styles.holeButtonActive,
                  !isActive && isComplete && styles.holeButtonComplete,
                ]}
                onPress={() => setCurrentHole(hole.holeNumber)}
              >
                <Text
                  style={[
                    styles.holeButtonText,
                    isActive && styles.holeButtonTextActive,
                    !isActive && isComplete && styles.holeButtonTextComplete,
                  ]}
                >
                  {hole.holeNumber}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Hole Info Header */}
      {currentHoleData && (
        <View style={styles.holeHeader}>
          <View style={styles.holeHeaderLeft}>
            <Text style={styles.holeTitle}>Hole {currentHole}</Text>
            <View style={styles.holeStats}>
              <View style={styles.parBadge}>
                <Text style={styles.parBadgeText}>PAR {currentHoleData.par}</Text>
              </View>
              {currentHoleData.yardage && (
                <Text style={styles.yardageText}>{currentHoleData.yardage} yds</Text>
              )}
              <Text style={styles.handicapText}>HCP {currentHoleData.handicapRank}</Text>
            </View>
          </View>
          {saving && (
            <ActivityIndicator size="small" color={colors.brand.primary} />
          )}
        </View>
      )}

      {/* Betting Status Banner */}
      <View style={styles.bettingBanner}>
        <Text style={styles.bettingBannerText}>Match Play: ALL SQUARE</Text>
      </View>

      {/* Player Score Cards */}
      <ScrollView style={styles.playersScroll} contentContainerStyle={styles.playersContent}>
        {round.players?.map((player, index) => {
          const score = getPlayerScore(player.id, currentHole);
          const par = currentHoleData?.par || 4;
          const scoreStyle = getScoreStyle(score, par);
          const scoreLabel = getScoreLabel(score, par);

          return (
            <View key={player.id} style={styles.playerCard}>
              <View style={styles.playerInfo}>
                <View
                  style={[
                    styles.playerAvatar,
                    { backgroundColor: index === 0 ? colors.brand.primary : colors.brand.accent },
                  ]}
                >
                  <Text style={styles.playerAvatarText}>
                    {player.user?.displayName?.[0] || player.user?.firstName?.[0] || '?'}
                  </Text>
                </View>
                <View style={styles.playerDetails}>
                  <Text style={styles.playerName}>
                    {player.user?.displayName || player.user?.firstName || 'Player'}
                  </Text>
                  <Text style={styles.playerStats}>
                    Thru {getHolesPlayed(player.id)} • {getScoreToPar(player.id)}
                  </Text>
                </View>
              </View>

              {/* Score Input */}
              <View style={styles.scoreSection}>
                {isEditable && (
                  <TouchableOpacity
                    style={styles.scoreAdjustButton}
                    onPress={() => handleScoreChange(player.id, Math.max(1, (score || par) - 1))}
                  >
                    <Text style={styles.scoreAdjustText}>-</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.scoreCircleContainer}>
                  <View
                    style={[
                      styles.scoreCircle,
                      {
                        backgroundColor: scoreStyle.bg,
                        borderColor: scoreStyle.border || scoreStyle.bg,
                      },
                    ]}
                  >
                    <Text style={[styles.scoreValue, { color: scoreStyle.text }]}>
                      {score ?? '-'}
                    </Text>
                  </View>
                  {scoreLabel && (
                    <Text style={styles.scoreLabel}>{scoreLabel}</Text>
                  )}
                </View>

                {isEditable && (
                  <TouchableOpacity
                    style={styles.scoreAdjustButton}
                    onPress={() => handleScoreChange(player.id, Math.min(15, (score || par) + 1))}
                  >
                    <Text style={styles.scoreAdjustText}>+</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {/* Quick Score Entry */}
        {isEditable && currentHoleData && round.players && round.players.length > 0 && (
          <View style={styles.quickEntry}>
            <Text style={styles.quickEntryLabel}>Quick Entry (Your Score)</Text>
            <View style={styles.quickEntryButtons}>
              {[
                { val: currentHoleData.par - 2, label: 'Eagle' },
                { val: currentHoleData.par - 1, label: 'Birdie' },
                { val: currentHoleData.par, label: 'Par' },
                { val: currentHoleData.par + 1, label: 'Bogey' },
                { val: currentHoleData.par + 2, label: 'Double' },
              ]
                .filter((item) => item.val >= 1)
                .map((item) => (
                  <TouchableOpacity
                    key={item.val}
                    style={styles.quickEntryButton}
                    onPress={() => {
                      const currentPlayer = round.players?.find(
                        (p) => p.userId === round.createdById
                      );
                      if (currentPlayer) {
                        handleScoreChange(currentPlayer.id, item.val);
                      }
                    }}
                  >
                    <Text style={styles.quickEntryValue}>{item.val}</Text>
                    <Text style={styles.quickEntryName}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navButton, currentHole === 1 && styles.navButtonDisabled]}
          onPress={() => setCurrentHole((h) => Math.max(1, h - 1))}
          disabled={currentHole === 1}
        >
          <Text style={styles.navButtonText}>Previous</Text>
        </TouchableOpacity>

        <View style={styles.holeIndicator}>
          <Text style={styles.holeIndicatorText}>{currentHole} of 18</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.navButton,
            styles.navButtonPrimary,
            currentHole === 18 && styles.navButtonDisabled,
          ]}
          onPress={() => setCurrentHole((h) => Math.min(18, h + 1))}
          disabled={currentHole === 18}
        >
          <Text style={styles.navButtonTextPrimary}>
            {currentHole === 18 ? 'Finish' : 'Next Hole'}
          </Text>
        </TouchableOpacity>
      </View>
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
  errorText: {
    ...typography.body,
    color: colors.functional.error,
  },

  // Hole Selector
  holeSelector: {
    backgroundColor: colors.background.surface,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  holeSelectorContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  holeButton: {
    width: HOLE_BUTTON_SIZE,
    height: HOLE_BUTTON_SIZE,
    borderRadius: HOLE_BUTTON_SIZE / 2,
    backgroundColor: colors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  holeButtonActive: {
    backgroundColor: colors.brand.primary,
  },
  holeButtonComplete: {
    backgroundColor: colors.background.elevated,
    borderWidth: 2,
    borderColor: colors.brand.primary,
  },
  holeButtonText: {
    ...typography.captionBold,
    color: colors.text.tertiary,
  },
  holeButtonTextActive: {
    color: colors.text.primary,
  },
  holeButtonTextComplete: {
    color: colors.brand.primary,
  },

  // Hole Header
  holeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  holeHeaderLeft: {
    flex: 1,
  },
  holeTitle: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  holeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  parBadge: {
    backgroundColor: colors.background.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  parBadgeText: {
    ...typography.label,
    color: colors.text.primary,
    fontWeight: '700',
  },
  yardageText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  handicapText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },

  // Betting Banner
  bettingBanner: {
    backgroundColor: colors.brand.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  bettingBannerText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    textAlign: 'center',
  },

  // Players
  playersScroll: {
    flex: 1,
  },
  playersContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  playerCard: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerAvatarText: {
    ...typography.h3,
    color: colors.text.primary,
  },
  playerDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  playerName: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  playerStats: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Score Section
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreAdjustButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreAdjustText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: -2,
  },
  scoreCircleContainer: {
    alignItems: 'center',
    minWidth: 70,
  },
  scoreCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  scoreLabel: {
    ...typography.label,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },

  // Quick Entry
  quickEntry: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  quickEntryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  quickEntryButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickEntryButton: {
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minWidth: (width - 80) / 5 - 8,
  },
  quickEntryValue: {
    ...typography.h2,
    color: colors.text.primary,
  },
  quickEntryName: {
    ...typography.label,
    color: colors.text.tertiary,
    marginTop: 2,
  },

  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing.md,
  },
  navButton: {
    flex: 1,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  navButtonPrimary: {
    backgroundColor: colors.brand.primary,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
  },
  navButtonTextPrimary: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  holeIndicator: {
    paddingHorizontal: spacing.md,
  },
  holeIndicatorText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
});
