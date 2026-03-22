import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { Tag } from '../types/index.js';

interface UseTagsResult {
  tags: Tag[];
  isLoading: boolean;
  createTag: (data: Pick<Tag, 'name' | 'icon' | 'color'>) => Promise<Tag>;
  updateTag: (id: string, data: Partial<Pick<Tag, 'name' | 'icon' | 'color'>>) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
}

export function useTags(): UseTagsResult {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get<Tag[]>('/tags')
      .then((data) => { setTags(data); })
      .catch(() => { /* silencieux : les tags sont optionnels */ })
      .finally(() => { setIsLoading(false); });
  }, []);

  const createTag = useCallback(async (data: Pick<Tag, 'name' | 'icon' | 'color'>) => {
    const tag = await api.post<Tag>('/tags', data);
    setTags((prev) => [...prev, tag]);
    return tag;
  }, []);

  const updateTag = useCallback(async (
    id: string,
    data: Partial<Pick<Tag, 'name' | 'icon' | 'color'>>,
  ) => {
    const tag = await api.patch<Tag>('/tags/' + id, data);
    setTags((prev) => prev.map((t) => (t.id === id ? tag : t)));
    return tag;
  }, []);

  const deleteTag = useCallback(async (id: string) => {
    await api.delete<undefined>('/tags/' + id);
    setTags((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tags, isLoading, createTag, updateTag, deleteTag };
}
