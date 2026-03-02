import { useState } from 'react';
import { WyvernConfig, RoleDefinition } from '../types';
import { useIpcListeners } from './hooks/useIpcListeners';
import { PipelineTree } from './components/PipelineTree';
import { ChatPanel } from './components/ChatPanel';
import { DetailPanel } from './components/DetailPanel';
import { ProjectSelector } from './components/ProjectSelector';
import { usePipelineStore } from './stores/pipeline-store';

interface ProjectData {
  config: WyvernConfig;
  roles: Record<string, RoleDefinition>;
  projectPath: string;
}

export default function App() {
  useIpcListeners();
  const [project, setProject] = useState<ProjectData | null>(null);
  const pipeline = usePipelineStore((s) => s.getActivePipeline());

  if (!project) {
    return <ProjectSelector onProjectLoaded={setProject} />;
  }

  const statusText = pipeline
    ? pipeline.status === 'active' ? 'Running' : pipeline.status.charAt(0).toUpperCase() + pipeline.status.slice(1)
    : 'Idle';

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-900 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-100">{project.config.project.name}</span>
          <span className="text-xs text-gray-500">[{statusText}]</span>
        </div>
        <button
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          onClick={() => setProject(null)}
        >[Change Project]</button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <PipelineTree />
        <ChatPanel projectPath={project.projectPath} />
        <DetailPanel />
      </div>
    </div>
  );
}
