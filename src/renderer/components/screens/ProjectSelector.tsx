import { useState } from 'react';
import { WyvernConfig, RoleDefinition } from '../../../types';
import wyvernLogo from '../../assets/wyvern-logo.png';

interface ProjectSelectorProps {
  onProjectLoaded: (data: {
    config: WyvernConfig;
    roles: Record<string, RoleDefinition>;
    projectPath: string;
  }) => void;
}

export function ProjectSelector({ onProjectLoaded }: ProjectSelectorProps) {
  const [error, setError] = useState<string | null>(null);
  const [cliWarnings, setCliWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [projectName, setProjectName] = useState('');

  async function handleCreate() {
    setError(null);
    setCliWarnings([]);
    setLoading(true);

    try {
      const result = await window.wyvern.createProject(projectName.trim());
      if (!result) {
        setLoading(false);
        return;
      }

      const { missing } = await window.wyvern.checkCliTools();
      if (missing.length > 0) {
        setCliWarnings(missing);
      }

      onProjectLoaded(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLoading(false);
    }
  }

  async function handleOpen() {
    setError(null);
    setCliWarnings([]);
    setLoading(true);

    try {
      const result = await window.wyvern.openProject();

      if (!result) {
        setLoading(false);
        return;
      }

      const { missing } = await window.wyvern.checkCliTools();
      if (missing.length > 0) {
        setCliWarnings(missing);
      }

      onProjectLoaded(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="relative flex flex-col items-center gap-6">
        <div
          className="glow-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, transparent 70%)' }}
        />

        <div className="relative flex flex-col items-center gap-2">
          <img src={wyvernLogo} alt="Wyvern" className="w-48 h-48 object-contain" />
          <p className="text-xs text-gray-400">AI Agent Orchestrator</p>
        </div>

        <div className="relative flex flex-col items-center gap-3">
          <button
            className="text-sm text-gray-300 hover:text-white transition-colors disabled:text-gray-600"
            onClick={handleOpen}
            disabled={loading}
          >
            {loading ? '[Opening...]' : '[Open Project]'}
          </button>

          {!showNameInput ? (
            <button
              className="text-sm text-gray-300 hover:text-white transition-colors disabled:text-gray-600"
              onClick={() => setShowNameInput(true)}
              disabled={loading}
            >
              [Create Project]
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  className="bg-gray-800 border border-gray-600 text-gray-100 text-sm px-2 py-1 focus:border-cyan-400 focus:outline-none w-48"
                  placeholder="Project name..."
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') {
                      setShowNameInput(false);
                      setProjectName('');
                    }
                  }}
                  autoFocus
                  disabled={loading}
                />
                {projectName.trim() && (
                  <span className="absolute top-1/2 -translate-y-1/2 text-sm text-gray-600 pointer-events-none" style={{ left: `calc(0.5rem + ${projectName.length}ch)` }}>
                    -wyvern/
                  </span>
                )}
              </div>
              <button
                className="text-sm text-gray-300 hover:text-white transition-colors disabled:text-gray-600"
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? '[Creating...]' : '[Confirm]'}
              </button>
              <button
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                onClick={() => { setShowNameInput(false); setProjectName(''); }}
                disabled={loading}
              >
                [Cancel]
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="relative text-xs text-red-400 text-center">{error}</p>
        )}

        {cliWarnings.length > 0 && (
          <div className="relative text-xs text-amber-400 text-center">
            <p>Missing CLI tools:</p>
            {cliWarnings.map((tool) => (
              <p key={tool} className="text-amber-300">{tool}</p>
            ))}
            <p className="text-gray-500 mt-1">Some agents may not work without these tools installed.</p>
          </div>
        )}

        <p className="relative text-xs text-gray-600 text-center max-w-[320px]">
          Open a directory with wyvern.yaml, or create a new project from template.
        </p>
      </div>
    </div>
  );
}
