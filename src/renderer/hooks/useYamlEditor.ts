import { useState, useEffect } from 'react';
import { ConfigUpdateResult, WyvernConfig, RoleDefinition } from '../../types';

interface UseYamlEditorOpts {
  filePath: string;
  saveFn: (content: string) => Promise<ConfigUpdateResult>;
  onSuccess: (result: { config: WyvernConfig; roles: Record<string, RoleDefinition> }) => void;
}

export function useYamlEditor({ filePath, saveFn, onSuccess }: UseYamlEditorOpts) {
  const [editing, setEditing] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditing(false);
    setError(null);
  }, [filePath]);

  function handleEdit() {
    window.wyvern.getArtifact(filePath).then((content) => {
      setYamlContent(content);
      setEditing(true);
      setError(null);
    }).catch(() => {
      setError('Failed to read file');
    });
  }

  function handleSave(content: string) {
    setSaving(true);
    setError(null);
    saveFn(content).then((result) => {
      setSaving(false);
      if (!result.ok || !result.config || !result.roles) {
        setError(result.error || 'Unknown error');
        return;
      }
      setEditing(false);
      onSuccess({ config: result.config, roles: result.roles });
    });
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
  }

  return { editing, yamlContent, saving, error, setError, handleEdit, handleSave, handleCancel };
}
