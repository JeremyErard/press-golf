import { useState } from 'react';
import { useRouter, Stack } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useApi, CreateCourseInput, ExtractedCourseData } from '../../../lib/api';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const DEFAULT_TEES = [
  { name: 'Black', color: '#000000' },
  { name: 'Blue', color: '#2563EB' },
  { name: 'White', color: '#FFFFFF' },
  { name: 'Gold', color: '#EAB308' },
  { name: 'Red', color: '#DC2626' },
];

interface TeeInput {
  name: string;
  color: string;
  slopeRating: string;
  courseRating: string;
  totalYardage: string;
  enabled: boolean;
}

export default function AddCourseScreen() {
  const router = useRouter();
  const api = useApi();

  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Basic info
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [website, setWebsite] = useState('');
  const [holes, setHoles] = useState<CreateCourseInput['holes']>([]);

  // Tees
  const [tees, setTees] = useState<TeeInput[]>(
    DEFAULT_TEES.map((t) => ({
      ...t,
      slopeRating: '',
      courseRating: '',
      totalYardage: '',
      enabled: false,
    }))
  );

  const toggleTee = (index: number) => {
    const newTees = [...tees];
    newTees[index].enabled = !newTees[index].enabled;
    setTees(newTees);
  };

  const updateTee = (index: number, field: keyof TeeInput, value: string) => {
    const newTees = [...tees];
    newTees[index] = { ...newTees[index], [field]: value };
    setTees(newTees);
  };

  const handleFetchFromUrl = async () => {
    if (!website.trim()) {
      Alert.alert('Error', 'Please enter a website URL first');
      return;
    }

    // Ensure URL has protocol
    let url = website.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
      setWebsite(url);
    }

    setFetching(true);

    try {
      const result = await api.post<ExtractedCourseData>('/courses/fetch-from-url', { url });

      if (result.success) {
        const data = result.data;

        // Populate form with extracted data
        if (data.name) setName(data.name);
        if (data.city) setCity(data.city);
        if (data.state) setState(data.state);
        if (data.website) setWebsite(data.website);

        // Update tees
        if (data.tees && data.tees.length > 0) {
          const newTees = tees.map((tee) => {
            const extractedTee = data.tees?.find(
              (t) => t.name.toLowerCase() === tee.name.toLowerCase()
            );
            if (extractedTee) {
              return {
                ...tee,
                enabled: true,
                slopeRating: extractedTee.slopeRating?.toString() || '',
                courseRating: extractedTee.courseRating?.toString() || '',
                totalYardage: extractedTee.totalYardage?.toString() || '',
              };
            }
            return tee;
          });
          setTees(newTees);
        }

        // Store holes for later
        if (data.holes && data.holes.length > 0) {
          setHoles(data.holes);
        }

        Alert.alert(
          'Success',
          `Extracted data for "${data.name || 'course'}"${data.holes?.length ? ` with ${data.holes.length} holes` : ''}`
        );
      } else {
        Alert.alert('Error', result.error.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch course data. Please try again.');
    }

    setFetching(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Course name is required');
      return;
    }

    setSaving(true);

    const enabledTees = tees.filter((t) => t.enabled);

    const courseData: CreateCourseInput = {
      name: name.trim(),
      city: city.trim() || undefined,
      state: state || undefined,
      website: website.trim() || undefined,
      tees: enabledTees.map((t) => ({
        name: t.name,
        color: t.color,
        slopeRating: t.slopeRating ? parseInt(t.slopeRating) : undefined,
        courseRating: t.courseRating ? parseFloat(t.courseRating) : undefined,
        totalYardage: t.totalYardage ? parseInt(t.totalYardage) : undefined,
      })),
      holes: holes.length > 0 ? holes : undefined,
    };

    const result = await api.post('/courses', courseData);

    if (result.success) {
      Alert.alert('Success', 'Course added successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Error', result.error.message);
    }

    setSaving(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen
        options={{
          title: 'Add Course',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: '#10B981', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={saving || !name.trim()}>
              <Text style={{ color: saving || !name.trim() ? '#6B7280' : '#10B981', fontSize: 16, fontWeight: '600' }}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
        bounces={true}
        keyboardShouldPersistTaps="handled"
      >
        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Course Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Course Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Pebble Beach Golf Links"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 2 }]}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor="#6B7280"
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                value={state}
                onChangeText={(text) => setState(text.toUpperCase().slice(0, 2))}
                placeholder="CA"
                placeholderTextColor="#6B7280"
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Website</Text>
            <View style={styles.urlRow}>
              <TextInput
                style={[styles.input, styles.urlInput]}
                value={website}
                onChangeText={setWebsite}
                placeholder="https://coursename.com"
                placeholderTextColor="#6B7280"
                keyboardType="url"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.fetchButton, fetching && styles.fetchButtonDisabled]}
                onPress={handleFetchFromUrl}
                disabled={fetching}
              >
                {fetching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.fetchButtonText}>Fetch</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.helpText}>
              Enter a course website and tap Fetch to auto-fill details
            </Text>
          </View>

          {/* Show extracted holes count */}
          {holes.length > 0 && (
            <View style={styles.extractedInfo}>
              <Text style={styles.extractedInfoText}>
                {holes.length} holes extracted from website
              </Text>
            </View>
          )}
        </View>

        {/* Tees */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tee Boxes</Text>
          <Text style={styles.sectionSubtitle}>
            Select the tees available at this course
          </Text>

          {tees.map((tee, index) => (
            <View key={tee.name} style={styles.teeContainer}>
              <TouchableOpacity
                style={styles.teeHeader}
                onPress={() => toggleTee(index)}
              >
                <View style={styles.teeHeaderLeft}>
                  <View
                    style={[
                      styles.teeColorDot,
                      { backgroundColor: tee.color },
                      tee.color === '#FFFFFF' && styles.whiteDot,
                    ]}
                  />
                  <Text style={styles.teeName}>{tee.name}</Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    tee.enabled && styles.checkboxChecked,
                  ]}
                >
                  {tee.enabled && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>

              {tee.enabled && (
                <View style={styles.teeDetails}>
                  <View style={styles.teeRow}>
                    <View style={styles.teeField}>
                      <Text style={styles.teeLabel}>Slope</Text>
                      <TextInput
                        style={styles.teeInput}
                        value={tee.slopeRating}
                        onChangeText={(v) => updateTee(index, 'slopeRating', v)}
                        placeholder="113"
                        placeholderTextColor="#6B7280"
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.teeField}>
                      <Text style={styles.teeLabel}>Rating</Text>
                      <TextInput
                        style={styles.teeInput}
                        value={tee.courseRating}
                        onChangeText={(v) => updateTee(index, 'courseRating', v)}
                        placeholder="72.0"
                        placeholderTextColor="#6B7280"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.teeField}>
                      <Text style={styles.teeLabel}>Yards</Text>
                      <TextInput
                        style={styles.teeInput}
                        value={tee.totalYardage}
                        onChangeText={(v) => updateTee(index, 'totalYardage', v)}
                        placeholder="6800"
                        placeholderTextColor="#6B7280"
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Add Course'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
  },
  urlRow: {
    flexDirection: 'row',
    gap: 8,
  },
  urlInput: {
    flex: 1,
  },
  fetchButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  fetchButtonDisabled: {
    backgroundColor: '#1E40AF',
  },
  fetchButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  helpText: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 6,
  },
  extractedInfo: {
    backgroundColor: '#065F46',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  extractedInfoText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '500',
  },
  teeContainer: {
    backgroundColor: '#374151',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  teeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  teeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teeColorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  teeDetails: {
    padding: 14,
    paddingTop: 0,
  },
  teeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  teeField: {
    flex: 1,
  },
  teeLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  teeInput: {
    backgroundColor: '#4B5563',
    borderRadius: 8,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#065F46',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
