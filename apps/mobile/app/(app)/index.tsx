import { useUser, useClerk } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../../lib/theme';
import { api } from '../../lib/api';

interface Round {
  id: string;
  status: 'SETUP' | 'ACTIVE' | 'COMPLETED';
  date: string;
  course: {
    id: string;
    name: string;
    city?: string;
    state?: string;
  };
  tee: {
    name: string;
  };
  players: Array<{
    id: string;
    user: {
      firstName?: string;
      lastName?: string;
    };
  }>;
}

const { width } = Dimensions.get('window');
const COURSE_CARD_WIDTH = (width - 60) / 2.5;

export default function Home() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [activeRound, setActiveRound] = useState<Round | null>(null);

  useEffect(() => {
    loadRounds();
  }, []);

  const loadRounds = async () => {
    try {
      const response = await api.get('/rounds');
      if (response.success && response.data) {
        const allRounds = response.data as Round[];
        setRounds(allRounds);

        // Find active round
        const active = allRounds.find(r => r.status === 'ACTIVE');
        setActiveRound(active || null);
      }
    } catch (error) {
      console.error('Failed to load rounds:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const firstName = user?.firstName || 'Golfer';

  // Mock career earnings - will be calculated from actual data later
  const careerEarnings = 345;
  const isPositive = careerEarnings >= 0;

  const recentRounds = rounds.filter(r => r.status === 'COMPLETED').slice(0, 5);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{firstName}</Text>
          </View>
          <Link href="/(app)/profile" asChild>
            <TouchableOpacity style={styles.avatar}>
              {user?.imageUrl ? (
                <Image source={{ uri: user.imageUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {firstName[0]?.toUpperCase() || '?'}
                </Text>
              )}
            </TouchableOpacity>
          </Link>
        </View>

        {/* Career Earnings Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroCardGradient}>
            <View style={styles.heroFlag}>
              <Text style={styles.heroFlagEmoji}>⛳</Text>
            </View>
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroLabel}>Career Earnings</Text>
            <Text style={[styles.heroAmount, !isPositive && styles.heroAmountNegative]}>
              {isPositive ? '+' : '-'}${Math.abs(careerEarnings)}
            </Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Career Nassau Net</Text>
            </View>
          </View>
        </View>

        {/* Active Round Card */}
        {activeRound && (
          <TouchableOpacity
            style={styles.activeRoundCard}
            onPress={() => router.push(`/(app)/rounds/${activeRound.id}`)}
          >
            <View style={styles.activeRoundHeader}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.activeRoundHole}>Hole 8</Text>
            </View>
            <Text style={styles.activeRoundCourse}>
              {activeRound.course.name} - You are 2 UP 🏆
            </Text>
            <TouchableOpacity
              style={styles.resumeButton}
              onPress={() => router.push(`/(app)/rounds/${activeRound.id}/scorecard`)}
            >
              <Text style={styles.resumeButtonText}>Resume Round</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Link href="/(app)/rounds/new" asChild>
            <TouchableOpacity style={styles.startRoundButton}>
              <Text style={styles.startRoundText}>Start a Round</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Recent Rounds */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Rounds</Text>
            <Link href="/(app)/rounds" asChild>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {recentRounds.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.roundsScroll}
            >
              {recentRounds.map((round) => (
                <TouchableOpacity
                  key={round.id}
                  style={styles.roundCard}
                  onPress={() => router.push(`/(app)/rounds/${round.id}`)}
                >
                  <View style={styles.roundCardImage}>
                    <Text style={styles.roundCardEmoji}>⛳</Text>
                  </View>
                  <Text style={styles.roundCardName} numberOfLines={2}>
                    {round.course.name}
                  </Text>
                  <Text style={styles.roundCardDate}>
                    {new Date(round.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Text>
                  <Text style={styles.roundCardResult}>+$25</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyRounds}>
              <Text style={styles.emptyRoundsText}>
                No rounds yet. Start your first round!
              </Text>
            </View>
          )}
        </View>

        {/* Feature Cards */}
        <View style={styles.featureCards}>
          <Link href="/(app)/courses" asChild>
            <TouchableOpacity style={styles.featureCard}>
              <Text style={styles.featureEmoji}>⛳</Text>
              <Text style={styles.featureTitle}>Courses</Text>
              <Text style={styles.featureDescription}>Browse & add courses</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/(app)/rounds" asChild>
            <TouchableOpacity style={styles.featureCard}>
              <Text style={styles.featureEmoji}>🏌️</Text>
              <Text style={styles.featureTitle}>Rounds</Text>
              <Text style={styles.featureDescription}>Track your games</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  greeting: {
    ...typography.body,
    color: colors.text.secondary,
  },
  userName: {
    ...typography.h1,
    color: colors.text.primary,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    ...typography.h2,
    color: colors.text.primary,
  },

  // Hero Card
  heroCard: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  heroCardGradient: {
    height: 80,
    backgroundColor: '#0D3320', // Dark green tint
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: spacing.lg,
    paddingBottom: spacing.sm,
  },
  heroFlag: {
    opacity: 0.6,
  },
  heroFlagEmoji: {
    fontSize: 48,
  },
  heroContent: {
    padding: spacing.lg,
  },
  heroLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  heroAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.brand.primary,
    marginBottom: spacing.sm,
  },
  heroAmountNegative: {
    color: colors.functional.error,
  },
  heroBadge: {
    backgroundColor: colors.brand.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  heroBadgeText: {
    ...typography.label,
    color: colors.text.primary,
    fontWeight: '600',
  },

  // Active Round Card
  activeRoundCard: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.brand.primary,
  },
  activeRoundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.functional.error,
    marginRight: spacing.xs,
  },
  liveText: {
    ...typography.label,
    color: colors.functional.error,
    fontWeight: '700',
  },
  activeRoundHole: {
    ...typography.captionBold,
    color: colors.text.secondary,
  },
  activeRoundCourse: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  resumeButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  resumeButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },

  // Quick Actions
  quickActions: {
    marginBottom: spacing.xl,
  },
  startRoundButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  startRoundText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },

  // Section
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  seeAllText: {
    ...typography.captionBold,
    color: colors.brand.primary,
  },

  // Rounds Scroll
  roundsScroll: {
    paddingRight: spacing.xl,
  },
  roundCard: {
    width: COURSE_CARD_WIDTH,
    marginRight: spacing.md,
  },
  roundCardImage: {
    width: '100%',
    height: COURSE_CARD_WIDTH * 0.7,
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  roundCardEmoji: {
    fontSize: 32,
  },
  roundCardName: {
    ...typography.captionBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  roundCardDate: {
    ...typography.label,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  roundCardResult: {
    ...typography.captionBold,
    color: colors.brand.primary,
  },
  emptyRounds: {
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  emptyRoundsText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  // Feature Cards
  featureCards: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  featureCard: {
    flex: 1,
    backgroundColor: colors.background.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  featureEmoji: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  featureTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  featureDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },

  // Sign Out
  signOutButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  signOutText: {
    ...typography.caption,
    color: colors.functional.error,
  },
});
