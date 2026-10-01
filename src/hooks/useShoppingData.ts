import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingList,
  ShoppingItem,
  ShoppingListSummary,
} from '../domain/finance/types';
import {
  getAllShoppingLists,
  getShoppingListSummaries,
  getShoppingItemsByListId,
  createShoppingList,
  updateShoppingList,
  archiveShoppingList,
  deleteShoppingList,
  createShoppingItem,
  updateShoppingItem,
  discardShoppingItem,
  restoreShoppingItem,
  deleteShoppingItem,
  purchaseShoppingItem,
} from '../database/repositories/shoppingRepository';

export function useShoppingData(activeListId?: string) {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [summaries, setSummaries] = useState<ShoppingListSummary[]>([]);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [allLists, allSummaries] = await Promise.all([
        getAllShoppingLists(true),
        getShoppingListSummaries(true),
      ]);
      setLists(allLists);
      setSummaries(allSummaries);

      if (activeListId) {
        const listItems = await getShoppingItemsByListId(activeListId);
        setItems(listItems);
      }
    } catch (err: any) {
      console.error('Error loading shopping data:', err);
      setError(err?.message || 'Failed to load shopping data');
    } finally {
      setIsLoading(false);
    }
  }, [activeListId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    lists,
    summaries,
    items,
    isLoading,
    error,
    refresh,
    createList: async (name: string) => {
      const created = await createShoppingList(name);
      await refresh();
      return created;
    },
    renameList: async (id: string, name: string) => {
      await updateShoppingList(id, { name });
      await refresh();
    },
    archiveList: async (id: string, isArchived = true) => {
      await archiveShoppingList(id, isArchived);
      await refresh();
    },
    deleteList: async (id: string) => {
      const res = await deleteShoppingList(id);
      await refresh();
      return res;
    },
    addItem: async (params: {
      listId: string;
      name: string;
      note?: string;
      productUrl?: string;
      estimatedPrice?: number;
    }) => {
      const created = await createShoppingItem(params);
      await refresh();
      return created;
    },
    editItem: async (
      id: string,
      updates: {
        name?: string;
        note?: string | null;
        productUrl?: string | null;
        estimatedPrice?: number | null;
      }
    ) => {
      const updated = await updateShoppingItem(id, updates);
      await refresh();
      return updated;
    },
    discardItem: async (id: string) => {
      await discardShoppingItem(id);
      await refresh();
    },
    restoreItem: async (id: string) => {
      await restoreShoppingItem(id);
      await refresh();
    },
    deleteItem: async (id: string) => {
      await deleteShoppingItem(id);
      await refresh();
    },
    purchaseItem: async (params: {
      itemId: string;
      purchasePrice: number;
      purchaseAccountId: string;
      categoryId?: string | null;
      purchaseDate?: string;
      customNote?: string;
    }) => {
      const res = await purchaseShoppingItem(params);
      await refresh();
      return res;
    },
  };
}
