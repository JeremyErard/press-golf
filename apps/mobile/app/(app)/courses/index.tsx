import { useState, useEffect, useCallback } from 'react';
import { useRouter, Stack } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useApi, Course } from '../../../lib/api';

export default function CoursesScreen() {
  const router = useRouter();
  const api = useApi();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCourses = useCallback(async (query = '') => {
    const params = query ? `?q=${encodeURIComponent(query)}` : '';
    const result = await api.get<Course[]>(`/courses${params}`);

    if (result.success) {
      setCourses(result.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [api]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleSearch = () => {
    setLoading(true);
    loadCourses(searchQuery);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCourses(searchQuery);
  };

  const renderCourse = ({ item }: { item: Course }) => (
    <TouchableOpacity
      style={styles.courseCard}
      onPress={() => router.push(`/courses/${item.id}`)}
    >
      <View style={styles.courseInfo}>
        <Text style={styles.courseName}>{item.name}</Text>
        {(item.city || item.state) && (
          <Text style={styles.courseLocation}>
            {[item.city, item.state].filter(Boolean).join(', ')}
          </Text>
        )}
        <View style={styles.courseMeta}>
          {item.tees && item.tees.length > 0 && (
            <View style={styles.metaBadge}>
              <Text style={styles.metaText}>{item.tees.length} tees</Text>
            </View>
          )}
          {item._count?.holes === 18 && (
            <View style={styles.metaBadge}>
              <Text style={styles.metaText}>18 holes</Text>
            </View>
          )}
          {item.isVerified && (
            <View style={[styles.metaBadge, styles.verifiedBadge]}>
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Courses',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/courses/add')}>
              <Text style={{ color: '#10B981', fontSize: 16 }}>+ Add</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search courses..."
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Course List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : courses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No courses found</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery ? 'Try a different search' : 'Add your first course to get started'}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/courses/add')}
          >
            <Text style={styles.addButtonText}>Add Course</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={courses}
          renderItem={renderCourse}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#10B981"
            />
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
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  courseCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  courseLocation: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 8,
  },
  courseMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaBadge: {
    backgroundColor: '#374151',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  metaText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  verifiedBadge: {
    backgroundColor: '#065F46',
  },
  verifiedText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
  },
  chevron: {
    color: '#6B7280',
    fontSize: 24,
    marginLeft: 8,
  },
});
