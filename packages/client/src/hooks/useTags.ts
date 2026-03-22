import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { Tag } from '../types/index.js';

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    api
      .get<Tag[]>('/tags')
      .then((data) => { setTags(data); })
      .catch(() => { /* silencieux : les tags sont optionnels */ });
  }, []);

  return tags;
}
