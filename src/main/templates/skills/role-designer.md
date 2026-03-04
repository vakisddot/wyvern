---
description: Design agent roles for Wyvern projects
user_invocable: true
---

# Wyvern Role Designer

Use this skill to design and create agent roles for a Wyvern project. Roles are YAML files in the `roles/` directory.

## Project Structure

```
my-wyvern-project/
  wyvern.yaml          # project config
  roles/               # one YAML file per role
    product-manager.yaml
    worker.yaml
  pipelines/           # created at runtime by orchestrator
```

## Role YAML Schema

Every role file must have these fields:

```yaml
description: Short summary of what the role does
model:
  provider: claude          # or gemini
  variant: sonnet-4-6       # model variant (see table below)
can_spawn: []               # list of role slugs this role can delegate to
max_depth: 0                # max recursion depth (0 = leaf, cannot spawn)
system_prompt: |
  Instructions for the agent.
```

Optional fields:

```yaml
entry_point: true           # exactly one role must have this
repo: my-repo               # key from wyvern.yaml repos - sets the agent's cwd
```

## Model Options

| Provider | Variant | Use case |
|----------|---------|----------|
| claude | opus-4-6 | Highest capability, complex reasoning |
| claude | sonnet-4-6 | Good balance of speed and capability |
| claude | haiku-4-5 | Fast and cheap, simple tasks |
| gemini | gemini-2.5-pro | Google's frontier model |
| gemini | gemini-2.5-flash | Google's fast model |

Pick the cheapest model that can handle the role's responsibility. Workers doing simple tasks should use haiku. Orchestrators that need to reason about task breakdown should use sonnet or opus.

## Validation Rules

The orchestrator enforces these rules at project load time:

1. **Exactly one entry point** - one role must have `entry_point: true`
2. **Spawn references** - every slug in `can_spawn` must match an existing role file
3. **Depth consistency** - if `can_spawn` is non-empty, `max_depth` must be >= 1
4. **No cycles** - spawn chains cannot be circular (A spawns B spawns A)

## Spawn Chain Design

The spawn chain defines your team hierarchy. Think of it as an org chart:

- **Entry point role** receives the user's directive and decides how to break it down
- **Mid-level roles** (optional) coordinate sub-teams or handle specific domains
- **Leaf roles** (`can_spawn: []`, `max_depth: 0`) do the actual work

The `max_depth` field limits how deep the recursion goes from that role. A role with `max_depth: 2` can spawn a child that itself spawns another child.

## Agent Protocol

Agents communicate through file artifacts. Each agent:
1. Receives a `directive.md` with its task
2. Writes an `output.md` with results

Spawning agents include `[WYVERN:SPAWN] role=<slug> input=<file.md>` lines in output.
Leaf agents end output with `[WYVERN:DONE]`.

**Sequential vs parallel spawning**: When a spawning agent emits multiple SPAWN lines, all tasks run in parallel. To run tasks sequentially (when task B depends on task A's output), spawn only task A first. The orchestrator re-invokes the agent with A's results, and the agent can then spawn task B with full context. This costs one extra re-invocation but produces better results than workers guessing at missing context.

System prompts should describe the role's purpose and decision-making approach. The orchestrator injects protocol instructions automatically - do not repeat SPAWN/DONE syntax in system prompts.

## Common Archetypes

**Orchestrator** (entry point) - breaks down directives, spawns specialists:
```yaml
can_spawn: [researcher, implementer, reviewer]
max_depth: 2
entry_point: true
```

**Researcher** - gathers information, reads code, produces analysis:
```yaml
can_spawn: []
max_depth: 0
```

**Implementer** - writes code, makes changes:
```yaml
can_spawn: []
max_depth: 0
```

**Reviewer** - checks work quality, suggests improvements:
```yaml
can_spawn: []
max_depth: 0
```

**Team Lead** - mid-level coordinator for a domain:
```yaml
can_spawn: [implementer, reviewer]
max_depth: 1
```

## Workflow

When a user asks to design roles:

1. Ask what their project does and what kind of work they want automated
2. Propose a role hierarchy (which roles, who spawns whom)
3. Write each role as a YAML file in `roles/`
4. Verify the spawn chain has exactly one entry point and no cycles
5. Choose models based on each role's complexity

## File Naming

Role files use kebab-case slugs: `roles/team-lead.yaml`, `roles/code-reviewer.yaml`. The filename (minus `.yaml`) becomes the slug used in `can_spawn` references.
