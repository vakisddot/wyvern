import { useState } from 'react';
import { WyvernConfig, RoleDefinition } from '../../types';

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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 p-8 w-[420px] flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-100 tracking-wider">Wyvern</h1>
          <p className="text-xs text-gray-400">AI Agent Orchestrator</p>
        </div>

        <button
          className="text-sm text-gray-300 hover:text-white transition-colors disabled:text-gray-600"
          onClick={handleOpen}
          disabled={loading}
        >
          {loading ? '[Opening...]' : '[Open Project]'}
        </button>

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        {cliWarnings.length > 0 && (
          <div className="text-xs text-amber-400 text-center">
            <p>Missing CLI tools:</p>
            {cliWarnings.map((tool) => (
              <p key={tool} className="text-amber-300">{tool}</p>
            ))}
            <p className="text-gray-500 mt-1">Some agents may not work without these tools installed.</p>
          </div>
        )}

        <p className="text-xs text-gray-600 text-center max-w-[320px]">
          Select a directory containing wyvern.yaml and .wyvern/roles/ to get started.
        </p>
      </div>
    </div>
  );
}
