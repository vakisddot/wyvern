---
description: Wyvern UI design system — load this before any renderer/GUI work
user_invocable: true
---

# Wyvern UI Design System

(OUTDATED) Reference mockup: `docs/plan/interface-example.jpg` — always check this image before building or modifying any UI component.

The app is a dark-themed three-panel layout with a CLI/terminal aesthetic.

## Typography

One font for the entire app: **JetBrains Mono** (loaded via Google Fonts). Everything — UI labels, buttons, chat messages, logs, code — is monospace. No system font stack. No sans-serif anywhere.

## Color Palette

- Background: subtle slate gradient (`gray-950` to `slate-900`, top-to-bottom). This is the **only gradient in the entire app**.
- Panel backgrounds: flat dark (`gray-900` range, no gradients). Opaque.
- Text: `gray-100` primary, `gray-400` secondary
- Accent: teal/cyan for interactive elements and highlights
- Borders: `gray-700`, subtle 1px
- **No gradients** on buttons, cards, badges, or any UI element. Flat colors only.

## Agent Status Colors (with glow)

Each status has a color used for the hexagon border and outer glow (`box-shadow` or `filter: drop-shadow`):

| Status | Color | Tailwind |
|--------|-------|----------|
| Running | amber | `amber-400` |
| Done | green | `emerald-400` |
| Failed | red | `red-400` |
| Waiting CEO | cyan | `cyan-400` |
| Spawning/Pending | blue | `blue-400` |

## Pipeline Tree (left panel, ~280px)

- Header: "Pipeline Tree" with active hierarchy name and total cost
- Agent nodes as a **visual connected tree** with thin vertical/angled connector lines between parent and child
- Each node is a **hexagon with a thick colored border** and a subtle outer glow matching the status color. Inside: a small icon or the role's first letter. The hexagon is the signature visual element of Wyvern.
- Role name + `[STATUS]` tag in brackets next to each hexagon
- No gradients on nodes. Flat fill, thick border, glow via box-shadow only.
- Nodes are clickable to select and inspect in the detail panel

## CLI/ImGui Aesthetic

All interactive elements use **bracketed monospace text**, not pill/rounded buttons:

- Buttons: `[Approve Plan]` `[Request Changes]` `[Abort]` — monospace text with literal bracket characters
- Tabs: `[Artifacts]` `[Logs]` `[Config]` — active tab has brighter text or underline
- No `border-radius` on buttons. No pill shapes. No filled button backgrounds.
- Hover effect: text color brightens or gets an underline. No background color change on hover.

## Chat Panel (center, flex-grow)

- Header: "Chat Panel"
- Scrollable message area:
  - CEO messages: labeled "CEO (You):"
  - Checkpoint messages: card with colored `CHECKPOINT` badge + agent name, message body, then bracketed action buttons below: `[Approve Plan]` `[Request Changes]` `[Abort]`
  - Status updates: subtle gray system messages
- Large textarea at bottom (multi-line, not single-line input) with dark background

## Detail Panel (right panel, ~350px)

- Header: "Detail Panel" with selected agent's role name in quotes
- Tab row: `[Artifacts]` `[Logs]` `[Config]` — bracketed text tabs
- Artifacts tab: file tree with folder/file icons showing the agent's pipeline directory, clickable to view content in a code viewer with line numbers
- Logs tab: streaming monospace output, auto-scroll
- Config tab: role YAML config (read-only)
- Footer bar: `Model: {provider}/{variant}` and `Context: {tokens} tokens`

## General Rules

- Title bar: "Wyvern — {Project Name}"
- Dense, professional, terminal-like feel. No excessive padding or whitespace.
- No gradients anywhere (except the app body background).
- No rounded pill buttons anywhere. Bracketed text only.
- No emojis in the UI.
- No em dashes.