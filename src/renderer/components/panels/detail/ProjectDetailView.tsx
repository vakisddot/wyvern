import { WyvernConfig } from '../../../../types';
import { FilePath } from '../../shared/FilePath';
import { ProjectData } from '../../screens/Workspace';
import { useYamlEditor } from '../../../hooks/useYamlEditor';
import { YamlEditor } from '../../shared/YamlEditor';
import { ReadOnlyFields } from '../../shared/ReadOnlyFields';

export function ProjectDetailView({ config, filePath, projectPath, onProjectUpdate }: {
  config: WyvernConfig;
  filePath: string;
  projectPath: string;
  onProjectUpdate: (data: ProjectData) => void;
}) {
  const editor = useYamlEditor({
    filePath,
    saveFn: (content) => window.wyvern.saveConfig(projectPath, content),
    onSuccess: ({ config, roles }) => onProjectUpdate({ projectPath, config, roles }),
  });

  const entries = Object.entries(config).filter(([, value]) => {
    if (value === undefined || value === null) return false;
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
      </div>
      {editor.error && <p className="text-xs text-red-400 break-words">{editor.error}</p>}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">source</span>
        <FilePath path={filePath} />
      </div>
      <ReadOnlyFields entries={entries} />
    </div>
  );
}
