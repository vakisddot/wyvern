import { useState, useRef, useCallback, useEffect } from 'react';
import { WyvernConfig, RoleDefinition } from '../../../types';
import { AgentsPanel } from '../panels/AgentsPanel';
import { ChatPanel } from '../panels/ChatPanel';
import { DetailPanel } from '../panels/DetailPanel';
import { TitleBar } from '../shared/TitleBar';
import { ResizeHandle } from '../shared/ResizeHandle';
import wyvernLogo from '../../assets/wyvern-logo.png';

export interface ProjectData {
  config: WyvernConfig;
  roles: Record<string, RoleDefinition>;
  projectPath: string;
}

const LEFT_DEFAULT = 280;
const RIGHT_DEFAULT = 350;
const MIN_PANEL = 180;
const MIN_CENTER = 300;

export function Workspace({ project, onChangeProject, onProjectUpdate }: { project: ProjectData; onChangeProject: () => void; onProjectUpdate: (data: ProjectData) => void }) {  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampWidths = useCallback((left: number, right: number): [number, number] => {
    const total = containerRef.current ? containerRef.current.offsetWidth : window.innerWidth;
    const maxSide = total - MIN_CENTER - MIN_PANEL;
    left = Math.max(MIN_PANEL, Math.min(left, maxSide));
    right = Math.max(MIN_PANEL, Math.min(right, total - left - MIN_CENTER));
    return [left, right];
  }, []);

  const onLeftDrag = useCallback((delta: number) => {
    setLeftWidth((prev) => {
      const [clamped] = clampWidths(prev + delta, rightWidth);
      return clamped;
    });
  }, [clampWidths, rightWidth]);

  const onRightDrag = useCallback((delta: number) => {
    setRightWidth((prev) => {
      const [, clamped] = clampWidths(leftWidth, prev - delta);
      return clamped;
    });
  }, [clampWidths, leftWidth]);

  useEffect(() => {
    function onResize() {
      const [l, r] = clampWidths(leftWidth, rightWidth);
      if (l !== leftWidth) setLeftWidth(l);
      if (r !== rightWidth) setRightWidth(r);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [leftWidth, rightWidth, clampWidths]);

  return (
    <div className="flex flex-col h-screen">
      <TitleBar projectName={project.config.project.name} onChangeProject={onChangeProject} />
      <div ref={containerRef} className="flex flex-1 overflow-hidden relative">
        <img
          src={wyvernLogo}
          alt=""
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] object-contain opacity-[0.02] pointer-events-none select-none"
        />
        <AgentsPanel roles={project.roles} style={{ width: leftWidth }} />
        <ResizeHandle onDrag={onLeftDrag} />
        <ChatPanel projectPath={project.projectPath} />
        <ResizeHandle onDrag={onRightDrag} />
        <DetailPanel roles={project.roles} config={project.config} projectPath={project.projectPath} onProjectUpdate={onProjectUpdate} style={{ width: rightWidth }} />
      </div>
    </div>
  );
}
