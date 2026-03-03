import { useState } from 'react';
import { usePipelineStore } from '../../../stores/pipeline-store';
import { ProjectData } from '../../screens/Workspace';
import { YamlEditor } from '../../shared/YamlEditor';
import newRoleTemplate from '../../../../main/templates/new-role.yaml';

export function CreateRoleView({ projectPath, onProjectUpdate }: {
  projectPath: string;
  onProjectUpdate: (data: ProjectData) => void;
}) {
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setCreatingRole = usePipelineStore((s) => s.setCreatingRole);
  const selectRole = usePipelineStore((s) => s.selectRole);

  function handleCreate(content: string) {
    const trimmedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!trimmedSlug) {
      setError('Slug is required');
      return;
    }
    setSaving(true);
    setError(null);
    window.wyvern.createRole(projectPath, trimmedSlug, content).then((result) => {
      setSaving(false);
      if (!result.ok || !result.config || !result.roles) {
        setError(result.error || 'Unknown error');
        return;
      }
      setCreatingRole(false);
      onProjectUpdate({ projectPath, config: result.config, roles: result.roles });
      selectRole(trimmedSlug);
    });
  }

  return (
    <div className="flex flex-col gap-2 flex-1 overflow-hidden">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">slug (filename)</span>
        <input
          type="text"
          className="bg-gray-800 border border-gray-600 text-gray-100 text-sm px-2 py-1 focus:border-cyan-400 focus:outline-none"
          placeholder="my-role"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>
      <YamlEditor
        content={newRoleTemplate}
        saving={saving}
        error={error}
        onSave={handleCreate}
        onCancel={() => setCreatingRole(false)}
      />
    </div>
  );
}
