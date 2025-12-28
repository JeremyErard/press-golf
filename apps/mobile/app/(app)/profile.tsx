import { useUser } from '@clerk/clerk-expo';
import { useRouter, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useApi, User, PaymentMethod, PaymentMethodInput } from '../../lib/api';

type PaymentType = 'VENMO' | 'ZELLE' | 'CASHAPP' | 'APPLE_PAY';

const PAYMENT_TYPES: { type: PaymentType; label: string; prefix: string; placeholder: string }[] = [
  { type: 'VENMO', label: 'Venmo', prefix: '@', placeholder: 'username' },
  { type: 'CASHAPP', label: 'Cash App', prefix: '$', placeholder: 'cashtag' },
  { type: 'ZELLE', label: 'Zelle', prefix: '', placeholder: 'email or phone' },
  { type: 'APPLE_PAY', label: 'Apple Pay', prefix: '', placeholder: 'phone number' },
];

export default function Profile() {
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const api = useApi();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [ghinNumber, setGhinNumber] = useState('');
  const [handicapIndex, setHandicapIndex] = useState('');

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPaymentType, setNewPaymentType] = useState<PaymentType>('VENMO');
  const [newPaymentHandle, setNewPaymentHandle] = useState('');

  // Load profile data
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const result = await api.get<User>('/users/me');

    if (result.success) {
      const user = result.data;
      setDisplayName(user.displayName || '');
      setPhone(user.phone || '');
      setGhinNumber(user.ghinNumber || '');
      setHandicapIndex(user.handicapIndex?.toString() || '');
      setPaymentMethods(user.paymentMethods || []);
    }

    setLoading(false);
  };

  const saveProfile = async () => {
    setSaving(true);

    const result = await api.patch<User>('/users/me', {
      displayName: displayName || null,
      phone: phone || null,
      ghinNumber: ghinNumber || null,
      handicapIndex: handicapIndex ? parseFloat(handicapIndex) : null,
    });

    if (result.success) {
      Alert.alert('Saved', 'Profile updated successfully');
    } else {
      Alert.alert('Error', result.error.message);
    }

    setSaving(false);
  };

  const addPaymentMethod = async () => {
    if (!newPaymentHandle.trim()) {
      Alert.alert('Error', 'Please enter a handle');
      return;
    }

    // Auto-add prefix if missing
    let handle = newPaymentHandle.trim();
    const typeConfig = PAYMENT_TYPES.find(t => t.type === newPaymentType);
    if (typeConfig?.prefix && !handle.startsWith(typeConfig.prefix)) {
      handle = typeConfig.prefix + handle;
    }

    const input: PaymentMethodInput = {
      type: newPaymentType,
      handle,
      isPreferred: paymentMethods.length === 0, // First one is preferred
    };

    const result = await api.post<PaymentMethod>('/users/me/payment-methods', input);

    if (result.success) {
      setPaymentMethods([...paymentMethods.filter(p => p.type !== newPaymentType), result.data]);
      setNewPaymentHandle('');
      setShowAddPayment(false);
    } else {
      Alert.alert('Error', result.error.message);
    }
  };

  const removePaymentMethod = async (id: string) => {
    Alert.alert(
      'Remove Payment Method',
      'Are you sure you want to remove this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await api.delete(`/users/me/payment-methods/${id}`);
            if (result.success) {
              setPaymentMethods(paymentMethods.filter(p => p.id !== id));
            } else {
              Alert.alert('Error', 'Failed to remove payment method');
            }
          },
        },
      ]
    );
  };

  const setPreferred = async (id: string) => {
    const result = await api.patch<PaymentMethod>(`/users/me/payment-methods/${id}/preferred`, {});
    if (result.success) {
      setPaymentMethods(
        paymentMethods.map(p => ({ ...p, isPreferred: p.id === id }))
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={{ color: '#10B981', fontSize: 16 }}>Done</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: '#10B981', fontSize: 16 }}>Done</Text>
            </TouchableOpacity>
          ),
        }}
      />
      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How others see you"
            placeholderTextColor="#6B7280"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="For Apple Pay"
            placeholderTextColor="#6B7280"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>GHIN #</Text>
            <TextInput
              style={styles.input}
              value={ghinNumber}
              onChangeText={setGhinNumber}
              placeholder="Optional"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Handicap</Text>
            <TextInput
              style={styles.input}
              value={handicapIndex}
              onChangeText={setHandicapIndex}
              placeholder="e.g., 12.4"
              placeholderTextColor="#6B7280"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveProfile}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Payment Methods Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          <TouchableOpacity onPress={() => setShowAddPayment(!showAddPayment)}>
            <Text style={styles.addButton}>{showAddPayment ? 'Cancel' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionSubtitle}>
          Add your payment handles so friends can pay you easily
        </Text>

        {/* Add Payment Form */}
        {showAddPayment && (
          <View style={styles.addPaymentForm}>
            <View style={styles.paymentTypes}>
              {PAYMENT_TYPES.map(({ type, label }) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.paymentTypeButton,
                    newPaymentType === type && styles.paymentTypeButtonActive,
                  ]}
                  onPress={() => setNewPaymentType(type)}
                >
                  <Text
                    style={[
                      styles.paymentTypeButtonText,
                      newPaymentType === type && styles.paymentTypeButtonTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.addPaymentRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={newPaymentHandle}
                onChangeText={setNewPaymentHandle}
                placeholder={PAYMENT_TYPES.find(t => t.type === newPaymentType)?.placeholder}
                placeholderTextColor="#6B7280"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.addPaymentButton} onPress={addPaymentMethod}>
                <Text style={styles.addPaymentButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Payment Methods List */}
        {paymentMethods.length === 0 ? (
          <Text style={styles.emptyText}>No payment methods added yet</Text>
        ) : (
          paymentMethods.map(method => (
            <View key={method.id} style={styles.paymentMethod}>
              <TouchableOpacity
                style={styles.paymentMethodInfo}
                onPress={() => setPreferred(method.id)}
              >
                <View style={styles.paymentMethodHeader}>
                  <Text style={styles.paymentMethodType}>
                    {PAYMENT_TYPES.find(t => t.type === method.type)?.label}
                  </Text>
                  {method.isPreferred && (
                    <View style={styles.preferredBadge}>
                      <Text style={styles.preferredBadgeText}>Preferred</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.paymentMethodHandle}>{method.handle}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removePaymentMethod(method.id)}>
                <Text style={styles.removeButton}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Account Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.accountInfo}>
          <Text style={styles.accountLabel}>Email</Text>
          <Text style={styles.accountValue}>
            {clerkUser?.emailAddresses[0]?.emailAddress}
          </Text>
        </View>
      </View>
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
  section: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#065F46',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '500',
  },
  addPaymentForm: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  paymentTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  paymentTypeButton: {
    backgroundColor: '#4B5563',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  paymentTypeButtonActive: {
    backgroundColor: '#10B981',
  },
  paymentTypeButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  paymentTypeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  addPaymentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addPaymentButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  addPaymentButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    fontStyle: 'italic',
  },
  paymentMethod: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentMethodType: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
  },
  preferredBadge: {
    backgroundColor: '#065F46',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  preferredBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '600',
  },
  paymentMethodHandle: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 4,
  },
  removeButton: {
    color: '#EF4444',
    fontSize: 14,
  },
  accountInfo: {
    marginTop: 8,
  },
  accountLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 4,
  },
  accountValue: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
