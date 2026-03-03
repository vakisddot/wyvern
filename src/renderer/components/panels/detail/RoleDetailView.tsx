import { useState, useEffect } from 'react';
import { usePipelineStore } from '../../../stores/pipeline-store';
import { RoleDefinition } from '../../../../types';
import { FilePath } from '../../shared/FilePath';
import { ProjectData } from '../../screens/Workspace';
import { useYamlEditor } from '../../../hooks/useYamlEditor';
import { YamlEditor } from '../../shared/YamlEditor';
import { InlineConfirm } from '../../shared/InlineConfirm';
import { ReadOnlyFields } from '../../shared/ReadOnlyFields';

export function RoleDetailView({ slug, role, filePath, projectPath, onProjectUpdate }: {
  slug: string;
  role: RoleDefinition;
  filePath: string;
  projectPath: string;
  onProjectUpdate: (data: ProjectData) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const selectRole = usePipelineStore((s) => s.selectRole);

  const editor = useYamlEditor({
    filePath,
    saveFn: (content) => window.wyvern.saveRole(projectPath, slug, content),
    onSuccess: ({ config, roles }) => onProjectUpdate({ projectPath, config, roles }),
  });

  useEffect(() => {
    setConfirmingDelete(false);
  }, [slug]);

  function handleDelete() {
    window.wyvern.deleteRole(projectPath, slug).then((result) => {
      if (!result.ok || !result.config || !result.roles) {
        editor.setError(result.error || 'Unknown error');
        setConfirmingDelete(false);
        return;
      }
      selectRole(null);
      onProjectUpdate({ projectPath, config: result.config, roles: result.roles });
    });
  }

  const entries = Object.entries(role).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });

  if (editor.editing) {
    return (
      <YamlEditor
        content={editor.yamlContent}
        saving={editor.saving}
        error={editor.error}
        onSave={editor.handleSave}
        onCancel={editor.handleCancel}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button className="text-xs text-gray-500 hover:text-cyan-400 transition-colors" onClick={editor.handleEdit}>[Edit]</button>
        {confirmingDelete ? (
          <InlineConfirm message={`Delete '${slug}'?`} onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
        ) : (
          <button className="text-xs text-gray-500 hover:text-red-400 transition-colors" onClick={() => setConfirmingDelete(true)}>[Delete]</button>
        )}
      </div>
      {editor.error && <p className="text-xs text-red-400 break-words">{editor.error}</p>}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">source</span>
        <FilePath path={filePath} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">slug</span>
        <span className="text-xs text-gray-400">{slug}</span>
      </div>
      <ReadOnlyFields entries={entries} />
    </div>
  );
}
