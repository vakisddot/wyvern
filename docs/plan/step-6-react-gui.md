# Step 6: React GUI — Three-Panel Layout

## Goal

Build the full React frontend with three-panel layout, Zustand state management, and real-time IPC-driven updates. Dark theme with CLI/terminal aesthetic. Read `CLAUDE.md` UI Design section and reference `docs/plan/interface-example.jpg` for visual direction.

## Prerequisites

Step 5 must be complete. The `window.wyvern` API must be available.

## Dependencies to Install

```bash
npm install react react-dom zustand
npm install -D @types/react @types/react-dom tailwindcss postcss autoprefixer postcss-loader
```

## Config Changes

### `tsconfig.json`

Add to `compilerOptions`:
```json
"jsx": "react-jsx"
```

### `webpack.renderer.config.ts`

Update the CSS rule to include PostCSS loader for Tailwind:

```typescript
rules.push({
  test: /\.css$/,
  use: [
    { loader: 'style-loader' },
    { loader: 'css-loader' },
    { loader: 'postcss-loader' },
  ],
});
```

### `postcss.config.js` (new file, project root)

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### `tailwind.config.js` (new file, project root)

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};
```

## Files to Modify

### `src/index.html`

Replace body content:
```html
<body class="dark">
  <div id="root"></div>
</body>
```

### `src/index.css`

Replace entirely with Tailwind directives plus dark theme base:

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply text-gray-100 m-0 p-0 overflow-hidden;
  font-family: 'JetBrains Mono', monospace;
  background: linear-gradient(180deg, #030712 0%, #0f172a 100%); /* gray-950 to slate-900, only gradient in the app */
}

/* Scrollbar styling for dark theme */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #4b5563; }
```

**Important:** JetBrains Mono is the single font for the entire app — UI labels, buttons, chat, logs, everything. No system font stack.

### `src/renderer.ts`

Replace entirely:

```typescript
import './index.css';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import App from './renderer/App';

const root = createRoot(document.getElementById('root')!);
root.render(createElement(App));
```

## Files to Create

### `src/renderer/App.tsx`

Root component. Three-panel flex layout:

```
+------------------+---------------------+-------------------+
|  Pipeline Tree   |    Chat Panel       |   Detail Panel    |
|  (left sidebar)  |    (center)         |   (right sidebar) |
|  ~250px fixed    |    flex-grow        |   ~350px fixed    |
+------------------+---------------------+-------------------+
```

- `flex h-screen` container, panels separated by `border-gray-700` borders
- Calls `useIpcListeners()` hook to subscribe to backend events
- Renders `PipelineTree`, `ChatPanel`, `DetailPanel`
- All panel backgrounds are flat `gray-900` (no gradients — the body gradient shows through if needed, but panels are opaque flat color)

### `src/renderer/stores/pipeline-store.ts`

Zustand store for pipeline state:

```typescript
interface PipelineStore {
  pipelines: PipelineState[];
  activePipelineId: string | null;
  selectedAgentId: string | null;

  setActivePipeline: (id: string) => void;
  selectAgent: (id: string | null) => void;
  updatePipeline: (state: PipelineState) => void;
  addPipeline: (state: PipelineState) => void;
  setPipelines: (pipelines: PipelineState[]) => void;
}
```

Derive helpers:
- `getActivePipeline()` — computed from `pipelines` + `activePipelineId`
- `getSelectedAgent()` — computed from active pipeline's agents + `selectedAgentId`

### `src/renderer/stores/chat-store.ts`

Zustand store for chat messages:

```typescript
interface ChatMessage {
  id: string;
  type: 'directive' | 'checkpoint' | 'approval' | 'rejection' | 'status' | 'agent-output';
  content: string;
  agentId?: string;
  roleName?: string;
  pipelineId?: string;
  timestamp: number;
}

interface ChatStore {
  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
}
```

Auto-generate `id` and `timestamp` in `addMessage`.

### `src/renderer/hooks/useIpcListeners.ts`

Custom hook that subscribes to IPC events and updates Zustand stores:

```typescript
function useIpcListeners(): void {
  useEffect(() => {
    const unsub1 = window.wyvern.onPipelineUpdate((state) => {
      usePipelineStore.getState().updatePipeline(state);
    });
    const unsub2 = window.wyvern.onAgentOutput((data) => {
      useChatStore.getState().addMessage({
        type: 'agent-output',
        content: data.chunk,
        agentId: data.agentId,
        pipelineId: data.pipelineId,
      });
    });
    const unsub3 = window.wyvern.onCheckpointRequest((data) => {
      useChatStore.getState().addMessage({
        type: 'checkpoint',
        content: data.message,
        agentId: data.agentId,
        pipelineId: data.pipelineId,
      });
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);
}
```

### `src/renderer/components/PipelineTree.tsx`

Left panel (~280px, fixed width, border-right). Reference `docs/plan/interface-example.jpg`.

- Header section:
  - Title: "Pipeline Tree"
  - Subtitle: "Active agent hierarchy: {projectName}"
  - Cost line: "[Total pipeline cost: $X.XX / $Y.YY warn]"
- If no active pipeline: "No active pipeline" placeholder
- If active pipeline: render agent tree as a **visual connected tree** (not just indented text):
  - Thin vertical/angled connector lines between parent and child nodes (use CSS borders/pseudo-elements or inline SVG)
  - Each node is a **hexagon with a thick colored border** and an outer glow matching the status color (use `box-shadow` or `filter: drop-shadow`). Inside the hexagon: a small icon or the role's first letter.
    - Status colors: emerald=done, amber=running, red=failed, cyan=waiting_ceo, blue=spawning/pending
  - Role name next to each hexagon
  - Status tag in brackets: `[RUNNING]`, `[DONE]`, `[SPAWNING]`, etc.
  - **No gradients** on nodes. Flat fill, thick colored border, glow via box-shadow only.
  - Find root agent (parentId === null), render it at top
  - For each agent, find children (where parentId === this agent's id), render below with connector lines
  - Click handler: `selectAgent(agentId)`
  - Highlight selected agent
- Scrollable overflow

### `src/renderer/components/ChatPanel.tsx`

Center panel (flex-grow, borders on both sides). Reference `docs/plan/interface-example.jpg`.

- Header: "Chat Panel"
- Scrollable message area (flex-grow, overflow-y-auto):
  - Each message styled by type:
    - `directive`: labeled "CEO (You):" with the message text. Distinct from agent messages.
    - `checkpoint`: distinctive card with a colored `CHECKPOINT` badge + agent role name as header, message body below (supports numbered lists, paragraphs), then a row of action buttons: `[Approve Plan]` `[Request Changes]` `[Abort]` — styled as **bracketed monospace text** (no pill buttons, no border-radius, no filled backgrounds — just text with brackets, hover brightens text)
    - `approval` / `rejection`: system message showing CEO's response
    - `status`: subtle gray system message (e.g., "Agent backend-engineer started")
    - `agent-output`: monospace, subtle/collapsible
  - Auto-scroll to bottom on new messages (use a ref + scrollIntoView)
- Input area at bottom:
  - Large textarea (multi-line, not a single-line input) with dark background
  - On submit (Enter or button):
    - Add directive message to chat store
    - Call `window.wyvern.startPipeline(text, projectPath)` if no active pipeline
    - Or send as CEO response if there's a pending checkpoint
  - Disable input while pipeline is running (except for checkpoint responses)

### `src/renderer/components/DetailPanel.tsx`

Right panel (~350px, fixed width, border-left). Reference `docs/plan/interface-example.jpg`.

- Header: "Detail Panel" with subtitle showing selected agent's role name in quotes (e.g., `'Backend Lead'`)
- Tab row below header: `[Artifacts]` `[Logs]` `[Config]` — **bracketed monospace text tabs** (no pill shapes, no rounded buttons — just text with brackets, active tab has brighter text or underline)
- If no agent selected: "Select an agent to view details" centered placeholder
- **Artifacts tab** (default):
  - File tree showing the agent's pipeline directory path (e.g., `.wyvern/pipelines/{id}/backend-lead/`)
  - Tree structure with folder/file icons:
    - `input/` folder with its files (e.g., `directive.md`)
    - `output/` folder with its files (e.g., `technical-plan.md`) — highlight active/selected file
    - `tasks/` folder with task files (e.g., `task-1-brief.md`, `task-2-brief.md`)
  - Click a file to view its content in a code viewer below the tree (monospace `<pre>` with line numbers)
  - Load content via `window.wyvern.getArtifact(path)`
- **Logs tab**:
  - Streaming monospace log of agent output, auto-scroll
  - Filter `agent-output` messages from chat store where `agentId` matches
- **Config tab**:
  - Show the agent's role YAML config (read-only)
- Footer bar at bottom of panel: `Model: {provider}/{variant}` and `Context: {tokens} tokens`
- Scrollable overflow

## Verification

1. `npm start` — app launches and shows three-panel dark theme layout
2. Pipeline tree panel visible on left (empty state)
3. Chat panel in center with input bar at bottom
4. Detail panel on right with "Select an agent" placeholder
5. Tailwind classes render correctly (check colors, spacing, layout)
6. No console errors on load
7. Typing in chat input and pressing Enter should trigger `startPipeline` (may fail gracefully if no project — that's fine, it should not crash)
