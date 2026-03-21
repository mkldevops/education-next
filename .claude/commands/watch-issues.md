Launch the issue-orchestrator agent to continuously monitor and process open GitHub issues.

The orchestrator will:
1. Fetch all open GitHub issues
2. Spawn up to 3 parallel issue-worker agents (each in an isolated git worktree)
3. Loop until all issues are processed
4. Accept commands via SendMessage while running:
   - `status` — show current progress
   - `pause` / `resume` — pause/resume spawning new workers
   - `stop` — finish current workers and exit
   - `create-issue <title>` — create a new GitHub issue on the fly
   - `skip #<number>` — skip an issue without processing it
   - `retry #<number>` — retry a failed issue
   - `workers` — list active worker agent IDs

Usage:
  /watch-issues

The orchestrator runs autonomously without user confirmation. Each worker implements the full APEX workflow (Analyze → Plan → Execute → Ship) and creates a PR via peaklab.ship-pr --auto-fix.
