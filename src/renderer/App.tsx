import { useState } from 'react';
import { useIpcListeners } from './hooks/useIpcListeners';
import { ProjectSelector } from './components/screens/ProjectSelector';
import { Workspace, ProjectData } from './components/screens/Workspace';

export default function App() {
  useIpcListeners();
  const [project, setProject] = useState<ProjectData | null>(null);

  if (!project) {
    return <ProjectSelector onProjectLoaded={setProject} />;
  }

  return <Workspace project={project} onChangeProject={() => setProject(null)} onProjectUpdate={setProject} />;
}
