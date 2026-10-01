import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import {
  Tag,
  Plus,
  Check,
  X,
  Folder,
  HelpCircle,
  Utensils,
  Car,
  ShoppingBag,
  Receipt,
  Film,
  GraduationCap,
  HeartPulse,
  Plane,
  Tv,
  Smile,
  Edit2,
  Archive,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Category } from '../../domain/finance/types';
import {
  getSelectableExpenseCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  isMonthlyGeneralCategory,
} from '../../database/repositories/categoryRepository';
import * as Haptics from 'expo-haptics';

export interface CategoryPickerFieldProps {
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  allowHistoricalMonth?: string | null; // e.g. '2026-08'
  label?: string;
  disabled?: boolean;
}

const ICON_MAP: Record<string, any> = {
  Folder,
  HelpCircle,
  Utensils,
  Car,
  ShoppingBag,
  Receipt,
  Film,
  GraduationCap,
  HeartPulse,
  Plane,
  Tv,
  Smile,
  Tag,
};

const COLOR_PALETTE = [
  '#6366F1', // Indigo
  '#F43F5E', // Rose
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#D4A373', // Champagne Gold
];

export const CategoryPickerField: React.FC<CategoryPickerFieldProps> = ({
  selectedCategoryId,
  onSelectCategory,
  allowHistoricalMonth,
  label = 'Category',
  disabled = false,
}) => {
  const { colors, radii, spacing, typography, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Create / Edit Category Modal state
  const [isManaging, setIsManaging] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]);
  const [newCatIcon, setNewCatIcon] = useState('Tag');

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const cats = await getSelectableExpenseCategories({
        allowHistoricalMonth,
        currentSelectionId: selectedCategoryId,
      });
      setCategories(cats);
    } catch (err) {
      console.warn('Failed to load categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (modalVisible) {
      loadCategories();
    }
  }, [modalVisible, selectedCategoryId, allowHistoricalMonth]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const handleSelect = (catId: string | null) => {
    Haptics.selectionAsync();
    onSelectCategory(catId);
    setModalVisible(false);
  };

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setNewCatName('');
    setNewCatColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]);
    setNewCatIcon('Tag');
    setIsManaging(true);
  };

  const handleOpenEdit = (cat: Category) => {
    if (isMonthlyGeneralCategory(cat)) {
      Alert.alert('System Category', 'Monthly General categories cannot be renamed.');
      return;
    }
    setEditingCategory(cat);
    setNewCatName(cat.name);
    setNewCatColor(cat.color || COLOR_PALETTE[0]);
    setNewCatIcon(cat.icon || 'Tag');
    setIsManaging(true);
  };

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) {
      Alert.alert('Required', 'Please enter a category name');
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: newCatName.trim(),
          color: newCatColor,
          icon: newCatIcon,
        });
      } else {
        const created = await createCategory({
          name: newCatName.trim(),
          type: 'EXPENSE',
          color: newCatColor,
          icon: newCatIcon,
        });
        // Auto-select newly created category
        onSelectCategory(created.id);
      }
      setIsManaging(false);
      await loadCategories();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save category');
    }
  };

  const handleArchive = async (cat: Category) => {
    Alert.alert(
      'Archive Category',
      `Archive "${cat.name}"? Existing expenses will preserve this category in records, but it will be hidden from new expenses.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            await archiveCategory(cat.id, true);
            if (selectedCategoryId === cat.id) {
              onSelectCategory(null);
            }
            await loadCategories();
            setIsManaging(false);
          },
        },
      ]
    );
  };

  const currentMonthGeneral = categories.find((c) => isMonthlyGeneralCategory(c));
  const customCategories = categories.filter((c) => !isMonthlyGeneralCategory(c));

  const SelectedIcon = selectedCategory ? (ICON_MAP[selectedCategory.icon] || Tag) : HelpCircle;

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {label} <Text style={{ color: colors.textMuted, fontSize: 12 }}>(Optional)</Text>
        </Text>
      ) : null}

      <Pressable
        onPress={() => {
          if (!disabled) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setModalVisible(true);
          }
        }}
        disabled={disabled}
        style={[
          styles.triggerBox,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            borderColor: selectedCategory ? colors.accent : colors.border,
            borderRadius: radii.md,
          },
        ]}
      >
        <View style={styles.triggerLeft}>
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: selectedCategory
                  ? `${selectedCategory.color || colors.accent}20`
                  : `${colors.textMuted}15`,
              },
            ]}
          >
            <SelectedIcon
              size={18}
              color={selectedCategory ? selectedCategory.color || colors.accent : colors.textMuted}
            />
          </View>
          <View>
            <Text
              style={[
                styles.triggerValue,
                {
                  color: selectedCategory ? colors.textPrimary : colors.textMuted,
                  fontFamily: typography.fontFamilies.medium,
                },
              ]}
            >
              {selectedCategory ? selectedCategory.name : 'Uncategorized (None)'}
            </Text>
            <Text style={[styles.triggerSubtext, { color: colors.textSecondary }]}>
              {selectedCategory
                ? isMonthlyGeneralCategory(selectedCategory)
                  ? 'Monthly fallback category'
                  : 'Custom expense category'
                : 'Default: No category assigned'}
            </Text>
          </View>
        </View>

        <ChevronRight size={18} color={colors.textMuted} />
      </Pressable>

      {/* Main Selection Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)} />
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surfaceElevated || colors.surface,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Select Category
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Optional classification for spending insights
                </Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={10}
                style={[styles.closeBtn, { backgroundColor: colors.borderSubtle }]}
              >
                <X size={18} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: 36 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Option: Uncategorized (Default) */}
              <Pressable
                onPress={() => handleSelect(null)}
                style={[
                  styles.categoryOption,
                  {
                    borderColor: selectedCategoryId === null ? colors.accent : colors.borderSubtle,
                    backgroundColor:
                      selectedCategoryId === null
                        ? `${colors.accent}12`
                        : isDark
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(0,0,0,0.02)',
                    borderRadius: radii.md,
                  },
                ]}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.optionIconBadge, { backgroundColor: 'rgba(148,163,184,0.15)' }]}>
                    <HelpCircle size={18} color="#94A3B8" />
                  </View>
                  <View>
                    <Text style={[styles.optionName, { color: colors.textPrimary }]}>
                      Uncategorized / None
                    </Text>
                    <Text style={[styles.optionMeta, { color: colors.textMuted }]}>
                      Default (leaves expense unclassified)
                    </Text>
                  </View>
                </View>
                {selectedCategoryId === null && <Check size={18} color={colors.accent} />}
              </Pressable>

              {/* Monthly Fallback Category Section */}
              {currentMonthGeneral ? (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                    MONTHLY GENERAL
                  </Text>
                  <Pressable
                    onPress={() => handleSelect(currentMonthGeneral.id)}
                    style={[
                      styles.categoryOption,
                      {
                        borderColor:
                          selectedCategoryId === currentMonthGeneral.id
                            ? colors.accent
                            : colors.borderSubtle,
                        backgroundColor:
                          selectedCategoryId === currentMonthGeneral.id
                            ? `${colors.accent}12`
                            : isDark
                            ? 'rgba(255,255,255,0.02)'
                            : 'rgba(0,0,0,0.02)',
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    <View style={styles.optionLeft}>
                      <View
                        style={[
                          styles.optionIconBadge,
                          { backgroundColor: `${currentMonthGeneral.color || '#94A3B8'}20` },
                        ]}
                      >
                        <Folder size={18} color={currentMonthGeneral.color || '#94A3B8'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionName, { color: colors.textPrimary }]}>
                          {currentMonthGeneral.name}
                        </Text>
                        <Text style={[styles.optionMeta, { color: colors.textMuted }]}>
                          Current month general spending bucket
                        </Text>
                      </View>
                    </View>
                    {selectedCategoryId === currentMonthGeneral.id && (
                      <Check size={18} color={colors.accent} />
                    )}
                  </Pressable>
                </View>
              ) : null}

              {/* Custom Global Categories Section */}
              <View style={{ marginTop: spacing.md }}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                    CUSTOM CATEGORIES
                  </Text>
                  <Pressable
                    onPress={handleOpenCreate}
                    hitSlop={10}
                    style={styles.newCatBtn}
                  >
                    <Plus size={14} color={colors.accent} />
                    <Text style={[styles.newCatText, { color: colors.accent }]}>
                      New Category
                    </Text>
                  </Pressable>
                </View>

                {customCategories.map((cat) => {
                  const CatIcon = ICON_MAP[cat.icon] || Tag;
                  const isSelected = selectedCategoryId === cat.id;

                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => handleSelect(cat.id)}
                      style={[
                        styles.categoryOption,
                        {
                          borderColor: isSelected ? colors.accent : colors.borderSubtle,
                          backgroundColor: isSelected
                            ? `${colors.accent}12`
                            : isDark
                            ? 'rgba(255,255,255,0.02)'
                            : 'rgba(0,0,0,0.02)',
                          borderRadius: radii.md,
                        },
                      ]}
                    >
                      <View style={styles.optionLeft}>
                        <View
                          style={[
                            styles.optionIconBadge,
                            { backgroundColor: `${cat.color || colors.accent}20` },
                          ]}
                        >
                          <CatIcon size={18} color={cat.color || colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.optionName, { color: colors.textPrimary }]}>
                            {cat.name}
                          </Text>
                          <Text style={[styles.optionMeta, { color: colors.textMuted }]}>
                            Reusable across all months
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(cat);
                          }}
                          hitSlop={10}
                          style={styles.catActionBtn}
                        >
                          <Edit2 size={15} color={colors.textMuted} />
                        </Pressable>
                        {isSelected && <Check size={18} color={colors.accent} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create / Edit Category Modal */}
      <Modal visible={isManaging} animationType="fade" transparent>
        <View style={styles.createModalOverlay}>
          <View
            style={[
              styles.createModalCard,
              {
                backgroundColor: colors.surfaceElevated || colors.surface,
                borderRadius: radii.lg,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.createModalHeader}>
              <Text style={[styles.createModalTitle, { color: colors.textPrimary }]}>
                {editingCategory ? 'Edit Category' : 'Create Custom Category'}
              </Text>
              <Pressable onPress={() => setIsManaging(false)} hitSlop={10}>
                <X size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>NAME</Text>
            <TextInput
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="e.g. Groceries, Gym, Coffee"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.textInput,
                {
                  color: colors.textPrimary,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  borderColor: colors.border,
                  borderRadius: radii.sm,
                },
              ]}
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 14 }]}>
              ACCENT COLOR
            </Text>
            <View style={styles.colorPalette}>
              {COLOR_PALETTE.map((col) => (
                <Pressable
                  key={col}
                  onPress={() => setNewCatColor(col)}
                  style={[
                    styles.colorDot,
                    {
                      backgroundColor: col,
                      borderColor: newCatColor === col ? colors.textPrimary : 'transparent',
                      borderWidth: newCatColor === col ? 2 : 0,
                    },
                  ]}
                />
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 14 }]}>
              ICON
            </Text>
            <View style={styles.iconPalette}>
              {Object.keys(ICON_MAP).map((iconKey) => {
                const IconComp = ICON_MAP[iconKey];
                const isSelected = newCatIcon === iconKey;
                return (
                  <Pressable
                    key={iconKey}
                    onPress={() => setNewCatIcon(iconKey)}
                    style={[
                      styles.iconDot,
                      {
                        backgroundColor: isSelected
                          ? `${newCatColor}25`
                          : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)',
                        borderColor: isSelected ? newCatColor : colors.borderSubtle,
                        borderWidth: isSelected ? 2 : 1,
                        borderRadius: radii.sm,
                      },
                    ]}
                    accessibilityLabel={`Select ${iconKey} icon`}
                  >
                    <IconComp size={16} color={isSelected ? newCatColor : colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.createModalActions}>
              {editingCategory && !isMonthlyGeneralCategory(editingCategory) && (
                <Pressable
                  onPress={() => handleArchive(editingCategory)}
                  style={[styles.archiveBtn, { borderColor: colors.borderSubtle }]}
                >
                  <Archive size={14} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>
                    Archive
                  </Text>
                </Pressable>
              )}

              <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <Pressable
                  onPress={() => setIsManaging(false)}
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveCategory}
                  style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                    Save
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  triggerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  triggerSubtext: {
    fontSize: 12,
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    marginTop: 14,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  newCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  newCatText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionName: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  catActionBtn: {
    padding: 6,
  },
  createModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  createModalCard: {
    width: '100%',
    padding: 20,
    borderWidth: 1,
  },
  createModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  createModalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  textInput: {
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  colorPalette: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  iconPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  iconDot: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 6,
  },
});
