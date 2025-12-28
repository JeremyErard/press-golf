import { useState, useEffect } from 'react';
import { useRouter, Stack } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useApi, Course, Tee, Round } from '../../../lib/api';

export default function NewRoundScreen() {
  const router = useRouter();
  const api = useApi();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedTee, setSelectedTee] = useState<Tee | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    const result = await api.get<Course[]>('/courses');
    if (result.success) {
      setCourses(result.data);
    }
    setLoading(false);
  };

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
    setSelectedTee(null);
  };

  const handleSelectTee = (tee: Tee) => {
    setSelectedTee(tee);
  };

  const handleCreateRound = async () => {
    if (!selectedCourse || !selectedTee) {
      Alert.alert('Error', 'Please select a course and tee');
      return;
    }

    setCreating(true);

    const result = await api.post<Round>('/rounds', {
      courseId: selectedCourse.id,
      teeId: selectedTee.id,
    });

    if (result.success) {
      router.replace(`/rounds/${result.data.id}`);
    } else {
      Alert.alert('Error', result.error.message);
      setCreating(false);
    }
  };

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
          title: 'New Round',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Course Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Course</Text>

          {courses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No courses yet</Text>
              <TouchableOpacity
                style={styles.addCourseButton}
                onPress={() => router.push('/courses/add')}
              >
                <Text style={styles.addCourseText}>Add a Course</Text>
              </TouchableOpacity>
            </View>
          ) : (
            courses.map((course) => (
              <TouchableOpacity
                key={course.id}
                style={[
                  styles.optionCard,
                  selectedCourse?.id === course.id && styles.optionSelected,
                ]}
                onPress={() => handleSelectCourse(course)}
              >
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{course.name}</Text>
                  {course.city && course.state && (
                    <Text style={styles.optionSubtitle}>
                      {course.city}, {course.state}
                    </Text>
                  )}
                </View>
                {selectedCourse?.id === course.id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Tee Selection */}
        {selectedCourse && selectedCourse.tees && selectedCourse.tees.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Tees</Text>

            {selectedCourse.tees.map((tee) => (
              <TouchableOpacity
                key={tee.id}
                style={[
                  styles.teeCard,
                  selectedTee?.id === tee.id && styles.optionSelected,
                ]}
                onPress={() => handleSelectTee(tee)}
              >
                <View
                  style={[
                    styles.teeColor,
                    { backgroundColor: tee.color || '#6B7280' },
                    tee.color === '#FFFFFF' && styles.whiteTee,
                  ]}
                />
                <View style={styles.teeInfo}>
                  <Text style={styles.teeName}>{tee.name}</Text>
                  <View style={styles.teeStats}>
                    {tee.totalYardage && (
                      <Text style={styles.teeStat}>{tee.totalYardage.toLocaleString()} yds</Text>
                    )}
                    {tee.courseRating && (
                      <Text style={styles.teeStat}>{tee.courseRating} rating</Text>
                    )}
                    {tee.slopeRating && (
                      <Text style={styles.teeStat}>{tee.slopeRating} slope</Text>
                    )}
                  </View>
                </View>
                {selectedTee?.id === tee.id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Create Button */}
        {selectedCourse && selectedTee && (
          <TouchableOpacity
            style={[styles.createButton, creating && styles.createButtonDisabled]}
            onPress={handleCreateRound}
            disabled={creating}
          >
            <Text style={styles.createButtonText}>
              {creating ? 'Creating...' : 'Start Round'}
            </Text>
          </TouchableOpacity>
        )}
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
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  cancelButton: {
    color: '#10B981',
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  optionCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 20,
    color: '#10B981',
    fontWeight: '700',
  },
  teeCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teeColor: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  whiteTee: {
    borderWidth: 1,
    borderColor: '#6B7280',
  },
  teeInfo: {
    flex: 1,
  },
  teeName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  teeStats: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 12,
  },
  teeStat: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  emptyState: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginBottom: 12,
  },
  addCourseButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addCourseText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
  },
  createButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#065F46',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
