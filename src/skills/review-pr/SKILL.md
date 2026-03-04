# /review-pr — Review a Pull Request

When invoked with a PR number or URL:

1. **Get PR details:**
   - Use `gh pr view <number> --json title,body,files,commits` to get PR info
   - Use `gh pr diff <number>` to see the full diff

2. **Analyze changes:**
   - Review each changed file for correctness, style, and potential issues
   - Check for common problems: unused imports, error handling, security issues
   - Verify test coverage for new code

3. **Provide feedback:**
   - Summarize the PR's purpose and approach
   - List specific issues found with file and line references
   - Suggest improvements where applicable
   - Note positive aspects of the implementation

4. **Optionally submit review:**
   - Use `gh pr review <number> --comment --body "..."` to leave comments
