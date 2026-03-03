import { usePipelineStore } from '../../stores/pipeline-store';

interface TitleBarProps {
  projectName: string;
  onChangeProject: () => void;
}

export function TitleBar({ projectName, onChangeProject }: TitleBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-900 shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-gray-100">{projectName}</span>
        <button
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          onClick={() => usePipelineStore.getState().selectAgent(null)}
        >[Details]</button>
      </div>
      <button
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        onClick={onChangeProject}
      >[Change Project]</button>
    </div>
  );
}
