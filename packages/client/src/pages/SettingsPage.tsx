import { useState } from 'react';
import { useTags } from '../hooks/useTags.js';
import { TagBadge } from '../components/TagBadge.js';
import { IconPicker } from '../components/IconPicker.js';
import styles from './SettingsPage.module.css';

const DEFAULT_COLORS = ['#8b5cf6', '#ef4444', '#38bdf8', '#4ade80', '#f59e0b', '#ec4899', '#6366f1'];

export function SettingsPage() {
  const { tags, isLoading, createTag, updateTag, deleteTag, restoreDefaults } = useTags();

  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('✦');
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0] ?? '#8b5cf6');
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleRestoreDefaults = async () => {
    setIsRestoring(true);
    setError(null);
    try {
      await restoreDefaults();
    } catch {
      setError('Erreur lors de la restauration des tags par défaut');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      await createTag({ name: newName.trim(), icon: newIcon, color: newColor });
      setNewName('');
      setNewIcon('✦');
      setNewColor(DEFAULT_COLORS[0] ?? '#8b5cf6');
    } catch {
      setError('Erreur lors de la création du tag');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTag(id);
    } catch {
      setError('Erreur lors de la suppression');
    }
    setConfirmDeleteId(null);
  };

  const startEdit = (tag: { id: string; name: string; icon: string; color: string }) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditIcon(tag.icon);
    setEditColor(tag.color);
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateTag(id, { name: editName.trim(), icon: editIcon, color: editColor });
      setEditingId(null);
    } catch {
      setError('Erreur lors de la modification');
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.content}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Tags</h2>
            <button
              type="button"
              className={styles.btnGhost}
              disabled={isRestoring}
              onClick={() => { void handleRestoreDefaults(); }}
            >
              {isRestoring ? '…' : '↺ Restaurer les tags par défaut'}
            </button>
          </div>

          {isLoading ? (
            <p className={styles.muted}>Chargement…</p>
          ) : (
            <ul className={styles.tagList}>
              {tags.map((tag) => (
                <li key={tag.id} className={styles.tagItem}>
                  {editingId === tag.id ? (
                    <div className={styles.editRow}>
                      <IconPicker value={editIcon} onChange={setEditIcon} />
                      <input
                        className={styles.input}
                        value={editName}
                        onChange={(e) => { setEditName(e.target.value); }}
                        placeholder="Nom"
                      />
                      <input
                        type="color"
                        className={styles.colorInput}
                        value={editColor}
                        onChange={(e) => { setEditColor(e.target.value); }}
                      />
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => { void handleUpdate(tag.id); }}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={() => { setEditingId(null); }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className={styles.tagRow}>
                      <TagBadge tag={tag} size="md" />
                      {tag.isDefault && <span className={styles.defaultLabel}>défaut</span>}
                      <div className={styles.tagActions}>
                        <button
                          type="button"
                          className={styles.btnGhost}
                          onClick={() => { startEdit(tag); }}
                        >
                          ✎
                        </button>
                        {confirmDeleteId === tag.id ? (
                          <button
                            type="button"
                            className={styles.btnDanger}
                            onClick={() => { void handleDelete(tag.id); }}
                          >
                            Confirmer
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.btnGhost}
                            onClick={() => { setConfirmDeleteId(tag.id); }}
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className={styles.createForm}>
            <h3 className={styles.createTitle}>Ajouter un tag</h3>
            <div className={styles.createRow}>
              <IconPicker value={newIcon} onChange={setNewIcon} />
              <input
                className={styles.input}
                value={newName}
                onChange={(e) => { setNewName(e.target.value); }}
                placeholder="Nom du tag"
              />
              <input
                type="color"
                className={styles.colorInput}
                value={newColor}
                onChange={(e) => { setNewColor(e.target.value); }}
              />
              <button
                type="button"
                className={styles.btn}
                disabled={!newName.trim() || isCreating}
                onClick={() => { void handleCreate(); }}
              >
                {isCreating ? '…' : '+ Créer'}
              </button>
            </div>
          </div>

          {error !== null && <p className={styles.error}>{error}</p>}
        </section>
      </main>
    </div>
  );
}
