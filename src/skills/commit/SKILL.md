# /commit — Create Git Commit

When invoked, follow this workflow:

1. **Gather info in parallel:**
   - Run `git status` to see all untracked/changed files
   - Run `git diff --staged` to see staged changes
   - Run `git diff` to see unstaged changes
   - Run `git log --oneline -10` to see recent commit message style

2. **Analyze changes:**
   - Summarize the nature of changes (feature, fix, refactor, etc.)
   - Ensure no secrets or credentials are staged (.env, keys, etc.)
   - Draft a concise commit message following the repo's style

3. **Stage and commit:**
   - Stage relevant files by name (never `git add .` or `git add -A`)
   - Create the commit with a descriptive message
   - Add `Co-Authored-By: Curio Code <curio-code@local>` trailer
   - Use HEREDOC for multi-line messages

4. **Verify:**
   - Run `git status` after committing to confirm success
   - If pre-commit hooks fail, fix issues and create a NEW commit (don't amend)
