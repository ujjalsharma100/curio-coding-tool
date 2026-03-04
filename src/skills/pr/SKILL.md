# /pr — Create a Pull Request

When invoked:

1. **Analyze branch:**
   - Run `git status` to check for uncommitted changes
   - Run `git log main..HEAD --oneline` (or appropriate base branch) to see commits
   - Run `git diff main...HEAD` to see all changes in the branch

2. **Draft PR content:**
   - Create a descriptive title summarizing the changes
   - Write a body with:
     - Summary section (1-3 bullet points of key changes)
     - Test plan section (how to verify the changes)
   - Use the HEREDOC format for the body

3. **Create the PR:**
   - Push the branch: `git push -u origin HEAD`
   - Create PR: `gh pr create --title "..." --body "..."`

4. **Report result:**
   - Return the PR URL for the user
