import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';

type AllergyOption = { value: string; label: string };

type Props = {
  value: string[];
  onChange: (v: string[]) => void;
};

function normalizeOption(item: any): AllergyOption {
  if (!item) return { value: '', label: '' };
  if (typeof item === 'string') return { value: item, label: item };
  return {
    value: String(item.value ?? item.label ?? item.name ?? item.id ?? ''),
    label: String(item.label ?? item.value ?? item.name ?? item.id ?? ''),
  };
}

export default function AllergyPicker({ value, onChange }: Props) {
  const [catalog, setCatalog] = useState<AllergyOption[]>([]);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.allergiesCatalog();
        const items: any[] = Array.isArray(r.items) ? r.items : [];
        setCatalog(items.map(normalizeOption).filter((item: AllergyOption) => item.value));
      } catch {
        setCatalog([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (option: AllergyOption) => {
    if (value.includes(option.value)) onChange(value.filter((v) => v !== option.value));
    else onChange([...value, option.value]);
  };

  const remove = (item: string) => onChange(value.filter((v) => v !== item));

  const add = () => {
    const t = custom.trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setCustom('');
  };

  const shownCatalog = catalog;

  return (
    <View>
      <Text style={styles.hint}>Suas alergias selecionadas ({value.length})</Text>
      {value.length === 0 ? (
        <Text style={styles.empty}>Nenhuma alergia selecionada. Toque nas opções abaixo ou digite uma nova.</Text>
      ) : (
        <View style={styles.selectedRow}>
          {value.map(v => (
            <View key={v} style={styles.selectedChip}>
              <Text style={styles.selectedTxt}>{v}</Text>
              <AccessiblePressable onPress={() => remove(v)} testID={`allergy-remove-${v}`}>
                <Ionicons name="close-circle" size={18} color="#fff" />
              </AccessiblePressable>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.hint}>Adicionar personalizada</Text>
      <View style={styles.addRow}>
        <TextInput
          value={custom} onChangeText={setCustom}
          placeholder="Ex.: Nimesulida"
          placeholderTextColor={colors.muted}
          style={styles.input}
          testID="allergy-custom-input"
        />
        <AccessiblePressable onPress={add} style={styles.addBtn} testID="allergy-add-btn">
          <Ionicons name="add" size={22} color="#fff" />
        </AccessiblePressable>
      </View>

      <Text style={styles.hint}>Lista rápida — toque para adicionar</Text>
      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} />
      ) : (
        <View style={styles.chipsRow}>
          {shownCatalog.map((item) => {
            const selected = value.includes(item.value);
            return (
              <AccessiblePressable
                key={item.value}
                onPress={() => toggle(item)}
                style={[styles.chip, selected && styles.chipOn]}
                testID={`allergy-option-${item.value}`}
              >
                {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                <Text style={[styles.chipTxt, selected && styles.chipTxtOn]}>{item.label}</Text>
              </AccessiblePressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: font.sm, fontWeight: '600', color: colors.onSurfaceTertiary, marginTop: spacing.md, marginBottom: spacing.sm },
  empty: { fontSize: font.sm, color: colors.muted, fontStyle: 'italic' },
  selectedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  selectedTxt: { color: '#fff', fontWeight: '600', fontSize: font.sm },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, fontSize: font.base, color: colors.onSurface, minHeight: 48 },
  addBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandSecondary, alignItems: 'center', justifyContent: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.brandSecondary, borderColor: colors.brandSecondary },
  chipTxt: { fontSize: font.sm, color: colors.onSurface, fontWeight: '600' },
  chipTxtOn: { color: '#fff' },
});
