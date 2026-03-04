import { PipelineState } from '../../../../types';
import { FilePath } from '../../shared/FilePath';

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

function duration(start: number, end: number): string {
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

const STATUS_COLORS: Record<string, string> = {
  active:    'text-amber-400',
  completed: 'text-emerald-400',
  failed:    'text-red-400',
  paused:    'text-blue-400',
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-600 uppercase">{label}</span>
      <div className="text-xs text-gray-300">{children}</div>
    </div>
  );
}

export function PipelineDetailView({ pipeline, projectPath }: { pipeline: PipelineState; projectPath: string }) {
  const agentCount = Object.keys(pipeline.agents).length;
  const folderPath = `${projectPath}/.wyvern/pipelines/${pipeline.id}`;

  return (
    <>
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-100">Detail Panel</h2>
        <p className="text-xs text-gray-400 mt-0.5">Pipeline</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        <InfoRow label="Directive">
          <p className="whitespace-pre-wrap">{pipeline.directive}</p>
        </InfoRow>
        <InfoRow label="Status">
          <span className={STATUS_COLORS[pipeline.status] ?? 'text-gray-300'}>
            [{pipeline.status.toUpperCase()}]
          </span>
        </InfoRow>
        <InfoRow label="ID">
          <span className="text-gray-500 font-mono">{pipeline.id}</span>
        </InfoRow>
        <InfoRow label="Agents">
          <span>{agentCount}</span>
        </InfoRow>
        <InfoRow label="Created">
          <span>{formatTimestamp(pipeline.createdAt)}</span>
        </InfoRow>
        <InfoRow label="Duration">
          <span>{duration(pipeline.createdAt, pipeline.updatedAt)}</span>
        </InfoRow>
        <InfoRow label="Folder">
          <FilePath path={folderPath} />
        </InfoRow>
      </div>
    </>
  );
}
