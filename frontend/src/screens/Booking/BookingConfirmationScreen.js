import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { createBooking, clearCurrent } from '../../store/bookingSlice';
import Button from '../../components/common/Button';
import Card   from '../../components/common/Card';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';
import { formatCurrency, formatDistance, formatETA, getAmbulanceType, haversineDistance } from '../../utils/helpers';
import { PAYMENT_METHODS } from '../../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BookingConfirmationScreen({ route, navigation }) {
  const { ambulance, location } = route.params;
  const dispatch = useDispatch();
  const { isCreating, current: booking, error } = useSelector((s) => s.booking);

  const [paymentMethod,  setPaymentMethod]  = useState('cash');
  const [patientDetails, setPatientDetails] = useState({ name: '', age: '', condition: '', bloodGroup: 'unknown' });
  const [emergencyContact, setEmergencyContact] = useState({ name: '', phone: '' });

  // Drop location
  const [dropAddress,    setDropAddress]    = useState('');
  const [dropCoords,     setDropCoords]     = useState(null);
  const [dropSuggestions, setDropSuggestions] = useState([]);
  const [dropSugLoading,  setDropSugLoading]  = useState(false);
  const [showDropSug,     setShowDropSug]     = useState(false);
  const dropDebounceRef = useRef(null);

  const nominatimSearch = useCallback(async (query) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&countrycodes=in`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    return data.map((r) => ({
      label:     r.display_name,
      shortLabel: [r.address?.road, r.address?.suburb, r.address?.city || r.address?.town || r.address?.village]
                    .filter(Boolean).join(', ') || r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  }, []);

  const fetchDropSuggestions = useCallback(async (query) => {
    if (!query || query.length < 3) { setDropSuggestions([]); return; }
    setDropSugLoading(true);
    try { setDropSuggestions(await nominatimSearch(query)); }
    catch (_) { setDropSuggestions([]); }
    finally { setDropSugLoading(false); }
  }, [nominatimSearch]);

  const handleDropTextChange = (text) => {
    setDropAddress(text);
    setShowDropSug(true);
    clearTimeout(dropDebounceRef.current);
    dropDebounceRef.current = setTimeout(() => fetchDropSuggestions(text), 400);
  };

  const handleSelectDropSuggestion = (s) => {
    setDropAddress(s.shortLabel);
    setDropCoords({ latitude: s.lat, longitude: s.lng });
    setDropSuggestions([]);
    setShowDropSug(false);
  };

  // Clear any stale booking from previous session on mount
  // Also load previously saved patient details
  useEffect(() => {
    dispatch(clearCurrent());
    AsyncStorage.getItem('abts_saved_booking_details').then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (saved.patientDetails)    setPatientDetails(saved.patientDetails);
        if (saved.emergencyContact)  setEmergencyContact(saved.emergencyContact);
        if (saved.dropAddress)       setDropAddress(saved.dropAddress);
        if (saved.dropCoords)        setDropCoords(saved.dropCoords);
        if (saved.paymentMethod)     setPaymentMethod(saved.paymentMethod);
      } catch (_) {}
    });
  }, [dispatch]);

  const typeConfig = getAmbulanceType(ambulance.type);

  // Estimated fare calculation
  const distanceKm = ambulance.distanceKm ?? 5;
  const fare = {
    base:  ambulance.basePrice,
    perKm: ambulance.pricePerKm * distanceKm,
    total: ambulance.basePrice + ambulance.pricePerKm * distanceKm,
  };

  // Once booking is created, move to tracking or confirmation
  useEffect(() => {
    if (booking && booking.status === 'pending') {
      navigation.replace('LiveTracking', { bookingId: booking._id });
    }
  }, [booking]);

  const doBooking = async () => {
    const result = await dispatch(
      createBooking({
        ambulanceId: ambulance._id,
        pickupLocation: {
          type: 'Point',
          coordinates: location ? [location.longitude, location.latitude] : [0, 0],
          address: route.params?.searchText || 'Current Location',
        },
        dropLocation: dropAddress
          ? { type: 'Point', coordinates: dropCoords ? [dropCoords.longitude, dropCoords.latitude] : [0, 0], address: dropAddress }
          : undefined,
        emergencyType: 'general',
        patientDetails: {
          name: patientDetails.name,
          age:  patientDetails.age ? parseInt(patientDetails.age) : undefined,
          condition: patientDetails.condition,
          bloodGroup: patientDetails.bloodGroup,
          emergencyContact: {
            name:  emergencyContact.name,
            phone: emergencyContact.phone,
          },
        },
        estimatedDistance: distanceKm,
        paymentMethod,
      })
    );

    if (createBooking.rejected.match(result)) {
      Alert.alert('Booking Failed', result.payload || 'Could not create booking. Please try again.');
    }
  };

  const handleSaveDetails = async () => {
    try {
      await AsyncStorage.setItem(
        'abts_saved_booking_details',
        JSON.stringify({ patientDetails, emergencyContact, dropAddress, dropCoords, paymentMethod })
      );
      Alert.alert('Saved', 'Details have been saved and will be pre-filled next time.');
    } catch (_) {
      Alert.alert('Error', 'Could not save details. Please try again.');
    }
  };

  const handleConfirm = () => {
    const pickup = route.params?.searchText || 'Current GPS Location';
    const message = `Pickup Location:\n${pickup}\n\nAre you sure you want to confirm this booking?`;
    if (Platform.OS === 'web') {
      const ok = window.confirm(`Confirm Booking\n\n${message}`);
      if (ok) doBooking();
    } else {
      Alert.alert(
        'Confirm Booking',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: doBooking },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Ambulance Summary */}
        <Card shadow="medium" style={styles.section}>
          <Text style={styles.sectionTitle}>Selected Ambulance</Text>
          <View style={styles.ambRow}>
            <View style={[styles.ambTypePill, { backgroundColor: typeConfig.color }]}>
              <Text style={styles.ambTypeText}>{typeConfig.label}</Text>
            </View>
            <View style={styles.ambInfo}>
              <Text style={styles.ambVehicle}>{ambulance.vehicleNumber}</Text>
              <Text style={styles.ambDriver}>🧑‍✈️ {ambulance.driverName}</Text>
            </View>
            <View>
              <MaterialCommunityIcons name="star" size={14} color="#FFC107" />
              <Text style={styles.ambRating}>{ambulance.rating?.average?.toFixed(1)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Distance</Text>
              <Text style={styles.infoValue}>{formatDistance(distanceKm * 1000)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>ETA</Text>
              <Text style={styles.infoValue}>{formatETA(ambulance.estimatedArrivalMin ?? Math.round(distanceKm * 1.5))}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Base Fare</Text>
              <Text style={styles.infoValue}>{formatCurrency(ambulance.basePrice)}</Text>
            </View>
          </View>
        </Card>

        {/* Patient Details */}
        <Card shadow="light" style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Details (Optional)</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Patient Name</Text>
              <TextInput
                style={styles.input}
                value={patientDetails.name}
                onChangeText={(v) => setPatientDetails((p) => ({ ...p, name: v }))}
                placeholder="Full name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Age</Text>
              <TextInput
                style={styles.input}
                value={patientDetails.age}
                onChangeText={(v) => setPatientDetails((p) => ({ ...p, age: v }))}
                placeholder="Age"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Condition / Notes</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={patientDetails.condition}
            onChangeText={(v) => setPatientDetails((p) => ({ ...p, condition: v }))}
            placeholder="Briefly describe the condition…"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
          />

          {/* Blood Group */}
          <Text style={[styles.inputLabel, { marginTop: Spacing.md, marginBottom: 8 }]}>Blood Group</Text>
          <View style={styles.bloodGroupGrid}>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
              <TouchableOpacity
                key={bg}
                style={[styles.bgChip, patientDetails.bloodGroup === bg && styles.bgChipActive]}
                onPress={() => setPatientDetails((p) => ({ ...p, bloodGroup: bg }))}
              >
                <Text style={[styles.bgChipText, patientDetails.bloodGroup === bg && styles.bgChipTextActive]}>{bg}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.bgChip, patientDetails.bloodGroup === 'unknown' && styles.bgChipActive]}
              onPress={() => setPatientDetails((p) => ({ ...p, bloodGroup: 'unknown' }))}
            >
              <Text style={[styles.bgChipText, patientDetails.bloodGroup === 'unknown' && styles.bgChipTextActive]}>Unknown</Text>
            </TouchableOpacity>
          </View>

          {/* Emergency Contact */}
          <Text style={[styles.inputLabel, { marginTop: Spacing.md, marginBottom: 8 }]}>Emergency Contact</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Contact Name</Text>
              <TextInput
                style={styles.input}
                value={emergencyContact.name}
                onChangeText={(v) => setEmergencyContact((c) => ({ ...c, name: v }))}
                placeholder="Full name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Contact Phone</Text>
              <TextInput
                style={styles.input}
                value={emergencyContact.phone}
                onChangeText={(v) => setEmergencyContact((c) => ({ ...c, phone: v }))}
                placeholder="10-digit number"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
          </View>
        </Card>

        {/* Drop Location */}
        <Card shadow="light" style={[styles.section, { zIndex: 10, overflow: 'visible' }]}>
          <Text style={styles.sectionTitle}>Drop Location (Optional)</Text>
          <View style={styles.dropWrapper}>
            <View style={styles.dropInputRow}>
              <MaterialCommunityIcons name="hospital-marker" size={18} color={Colors.secondary} style={styles.dropIcon} />
              <TextInput
                style={styles.dropInput}
                value={dropAddress}
                onChangeText={handleDropTextChange}
                placeholder="Hospital name or address"
                placeholderTextColor={Colors.textMuted}
                onFocus={() => dropAddress.length >= 3 && setShowDropSug(true)}
                onBlur={() => setTimeout(() => setShowDropSug(false), 150)}
                returnKeyType="search"
              />
              {dropSugLoading && <ActivityIndicator size="small" color={Colors.secondary} style={{ marginLeft: 6 }} />}
              {dropAddress.length > 0 && !dropSugLoading && (
                <TouchableOpacity onPress={() => { setDropAddress(''); setDropCoords(null); setDropSuggestions([]); }}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            {showDropSug && dropSuggestions.length > 0 && (
              <View style={styles.dropSugBox}>
                {dropSuggestions.map((s, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.dropSugItem, idx < dropSuggestions.length - 1 && styles.dropSugBorder]}
                    onPress={() => handleSelectDropSuggestion(s)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="map-marker-outline" size={15} color={Colors.secondary} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dropSugShort} numberOfLines={1}>{s.shortLabel}</Text>
                      <Text style={styles.dropSugFull}  numberOfLines={1}>{s.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </Card>

        {/* Payment Method */}
        <Card shadow="light" style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.payRow}>
            {PAYMENT_METHODS.map((m) => (
              <TouchableOpacity
                key={m.value}
                style={[styles.payChip, paymentMethod === m.value && styles.payChipActive]}
                onPress={() => setPaymentMethod(m.value)}
              >
                <Text style={[styles.payText, paymentMethod === m.value && styles.payTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Fare Breakdown */}
        <Card shadow="light" style={styles.section}>
          <Text style={styles.sectionTitle}>Fare Estimate</Text>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Base Fare</Text>
            <Text style={styles.fareValue}>{formatCurrency(fare.base)}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>{distanceKm.toFixed(1)} km × {formatCurrency(ambulance.pricePerKm)}</Text>
            <Text style={styles.fareValue}>{formatCurrency(fare.perKm)}</Text>
          </View>
          <View style={[styles.fareRow, styles.fareTotalRow]}>
            <Text style={styles.fareTotalLabel}>Total Estimate</Text>
            <Text style={styles.fareTotalValue}>{formatCurrency(fare.total)}</Text>
          </View>
          <Text style={styles.fareDisclaimer}>* Final fare may vary based on actual distance</Text>
        </Card>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <View style={styles.footerTopRow}>
          <View>
            <Text style={styles.footerLabel}>Estimated Fare</Text>
            <Text style={styles.footerFare}>{formatCurrency(fare.total)}</Text>
          </View>
          <Button
            title="Confirm Booking"
            onPress={handleConfirm}
            loading={isCreating}
            size="lg"
            style={styles.confirmBtn}
            icon={<MaterialCommunityIcons name="check-circle" size={20} color={Colors.white} />}
          />
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDetails}>
          <MaterialCommunityIcons name="content-save-outline" size={18} color={Colors.primary} />
          <Text style={styles.saveBtnText}>Save Details</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.md, paddingBottom: 100 },
  section:   { marginBottom: Spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  ambRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  ambTypePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full, minWidth: 60, alignItems: 'center' },
  ambTypeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  ambInfo:   { flex: 1 },
  ambVehicle:{ fontSize: 16, fontWeight: '700', color: Colors.text },
  ambDriver: { fontSize: 13, color: Colors.textSecondary },
  ambRating: { fontSize: 12, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  infoRow:   { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.sm },
  infoItem:  { flex: 1, alignItems: 'center' },
  infoLabel: { fontSize: 11, color: Colors.textSecondary },
  infoValue: { fontSize: 13, fontWeight: '700', color: Colors.text },
  chipGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  readonlyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.sm },
  readonlyText: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
  eChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  eChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  eChipText:   { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  eChipTextActive: { color: Colors.white },
  inputRow:  { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  inputHalf: { flex: 1 },
  inputLabel:{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, padding: Spacing.sm,
    fontSize: 14, color: Colors.text, backgroundColor: Colors.surface,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top', marginBottom: 0 },
  payRow:    { flexDirection: 'row', gap: 10 },
  payChip:   { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border },
  payChipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  payText:   { fontSize: 13, color: Colors.text, fontWeight: '500' },
  payTextActive: { color: Colors.white },
  fareRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  fareLabel: { fontSize: 14, color: Colors.textSecondary },
  fareValue: { fontSize: 14, fontWeight: '600', color: Colors.text },
  fareTotalRow:   { borderBottomWidth: 0, marginTop: 4 },
  fareTotalLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  fareTotalValue: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  fareDisclaimer: { fontSize: 11, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'center' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    flexDirection: 'column',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
  },
  footerTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  footerLabel: { fontSize: 12, color: Colors.textSecondary },
  footerFare:  { fontSize: 20, fontWeight: '800', color: Colors.primary },
  confirmBtn:  { flex: 1, marginLeft: Spacing.lg },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 10, marginTop: 2,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  reSearchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 12, marginBottom: Spacing.md,
  },
  reSearchText: { color: Colors.white, fontWeight: '700', fontSize: 14 },

  // Blood group chips
  bloodGroupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  bgChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
    minWidth: 52, alignItems: 'center',
  },
  bgChipActive:    { backgroundColor: Colors.error || '#E53935', borderColor: Colors.error || '#E53935' },
  bgChipText:      { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  bgChipTextActive:{ color: Colors.white },

  pickupHint: { fontSize: 12, color: '#E53935', marginTop: 6, marginLeft: 4 },
  dropInputRowError: { borderColor: '#E53935' },

  // Drop location autocomplete
  dropWrapper:   { position: 'relative' },
  dropInputRow:  {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface, minHeight: 44,
  },
  dropIcon:   { marginRight: 6 },
  dropInput:  { flex: 1, fontSize: 14, color: Colors.text, paddingVertical: Spacing.sm },
  dropSugBox: {
    position: 'absolute', top: 48, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
    zIndex: 999, elevation: 10,
    overflow: 'hidden',
  },
  dropSugItem:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.md, backgroundColor: Colors.white },
  dropSugBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropSugShort:  { fontSize: 13, fontWeight: '600', color: Colors.text },
  dropSugFull:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
});
