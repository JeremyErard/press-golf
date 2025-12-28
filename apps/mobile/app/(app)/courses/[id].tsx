import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useApi, Course } from '../../../lib/api';

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useApi();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourse();
  }, [id]);

  const loadCourse = async () => {
    if (!id) return;

    const result = await api.get<Course>(`/courses/${id}`);
    if (result.success) {
      setCourse(result.data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (!course) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ title: 'Error' }} />
        <Text style={styles.errorText}>Course not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalPar = course.holes?.reduce((sum, h) => sum + h.par, 0) || 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: course.name,
          headerBackTitle: 'Courses',
        }}
      />

      {/* Course Header */}
      <View style={styles.header}>
        <Text style={styles.courseName}>{course.name}</Text>
        {(course.city || course.state) && (
          <Text style={styles.location}>
            {[course.city, course.state].filter(Boolean).join(', ')}
          </Text>
        )}
        {course.website && (
          <TouchableOpacity onPress={() => Linking.openURL(course.website!)}>
            <Text style={styles.website}>{course.website}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tees Section */}
      {course.tees && course.tees.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tee Boxes</Text>
          {course.tees.map((tee) => (
            <View key={tee.id} style={styles.teeCard}>
              <View style={styles.teeHeader}>
                <View
                  style={[
                    styles.teeColorDot,
                    { backgroundColor: tee.color || '#6B7280' },
                    tee.color === '#FFFFFF' && styles.whiteDot,
                  ]}
                />
                <Text style={styles.teeName}>{tee.name}</Text>
              </View>
              <View style={styles.teeStats}>
                {tee.totalYardage && (
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{tee.totalYardage.toLocaleString()}</Text>
                    <Text style={styles.statLabel}>yards</Text>
                  </View>
                )}
                {tee.courseRating && (
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{Number(tee.courseRating).toFixed(1)}</Text>
                    <Text style={styles.statLabel}>rating</Text>
                  </View>
                )}
                {tee.slopeRating && (
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{tee.slopeRating}</Text>
                    <Text style={styles.statLabel}>slope</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Holes Section */}
      {course.holes && course.holes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scorecard</Text>
          <Text style={styles.sectionSubtitle}>
            Par {totalPar} • {course.holes.length} holes
          </Text>

          {/* Front 9 */}
          <View style={styles.nineContainer}>
            <Text style={styles.nineTitle}>Front 9</Text>
            <View style={styles.holesGrid}>
              {course.holes.slice(0, 9).map((hole) => (
                <View key={hole.id} style={styles.holeCell}>
                  <Text style={styles.holeNumber}>{hole.holeNumber}</Text>
                  <Text style={styles.holePar}>Par {hole.par}</Text>
                  <Text style={styles.holeHcp}>HCP {hole.handicapRank}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Back 9 */}
          {course.holes.length > 9 && (
            <View style={styles.nineContainer}>
              <Text style={styles.nineTitle}>Back 9</Text>
              <View style={styles.holesGrid}>
                {course.holes.slice(9, 18).map((hole) => (
                  <View key={hole.id} style={styles.holeCell}>
                    <Text style={styles.holeNumber}>{hole.holeNumber}</Text>
                    <Text style={styles.holePar}>Par {hole.par}</Text>
                    <Text style={styles.holeHcp}>HCP {hole.handicapRank}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* No Hole Data Message */}
      {(!course.holes || course.holes.length === 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scorecard</Text>
          <Text style={styles.noDataText}>
            Hole information not yet added for this course
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 18,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#374151',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  courseName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  location: {
    color: '#9CA3AF',
    fontSize: 16,
    marginBottom: 8,
  },
  website: {
    color: '#10B981',
    fontSize: 14,
  },
  section: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 16,
  },
  teeCard: {
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  teeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teeColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  whiteDot: {
    borderWidth: 1,
    borderColor: '#6B7280',
  },
  teeName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  teeStats: {
    flexDirection: 'row',
    gap: 24,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  nineContainer: {
    marginBottom: 16,
  },
  nineTitle: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  holesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  holeCell: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 8,
    width: '10%',
    minWidth: 60,
    alignItems: 'center',
  },
  holeNumber: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  holePar: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  holeHcp: {
    color: '#6B7280',
    fontSize: 10,
  },
  noDataText: {
    color: '#6B7280',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
  },
});
