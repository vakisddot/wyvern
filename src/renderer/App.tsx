import { useState, useRef, useCallback, useEffect } from 'react';
import { WyvernConfig, RoleDefinition } from '../types';
import { useIpcListeners } from './hooks/useIpcListeners';
import { PipelineTree } from './components/PipelineTree';
import { ChatPanel } from './components/ChatPanel';
import { DetailPanel } from './components/DetailPanel';
import { ProjectSelector } from './components/ProjectSelector';
import { usePipelineStore } from './stores/pipeline-store';
import wyvernLogo from './assets/wyvern-logo.png';

interface ProjectData {
  config: WyvernConfig;
  roles: Record<string, RoleDefinition>;
  projectPath: string;
}

const LEFT_DEFAULT = 280;
const RIGHT_DEFAULT = 350;
const MIN_PANEL = 180;
const MIN_CENTER = 300;

function ResizeHandle({ onDrag }: { onDrag: (delta: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    const delta = e.clientX - lastX.current;
    lastX.current = e.clientX;
    onDrag(delta);
  }, [onDrag]);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  return (
    <div
      className="w-1 shrink-0 cursor-col-resize bg-gray-700 hover:bg-gray-500 transition-colors"
      onMouseDown={onMouseDown}
    />
  );
}

export default function App() {
  useIpcListeners();
  const [project, setProject] = useState<ProjectData | null>(null);
  const pipeline = usePipelineStore((s) => s.getActivePipeline());
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
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
          <button
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            onClick={() => usePipelineStore.getState().selectAgent(null)}
          >[Details]</button>
        </div>
        <button
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          onClick={() => setProject(null)}
        >[Change Project]</button>
      </div>
      <div ref={containerRef} className="flex flex-1 overflow-hidden relative">
        <img
          src={wyvernLogo}
          alt=""
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] object-contain opacity-[0.02] pointer-events-none select-none"
        />
        <PipelineTree roles={project.roles} style={{ width: leftWidth }} />
        <ResizeHandle onDrag={onLeftDrag} />
        <ChatPanel projectPath={project.projectPath} />
        <ResizeHandle onDrag={onRightDrag} />
        <DetailPanel roles={project.roles} config={project.config} projectPath={project.projectPath} style={{ width: rightWidth }} />
      </div>
    </div>
  );
}
