# /simplify — Code Quality Review

When invoked:

1. **Identify scope:**
   - Review recently changed files or files specified by the user
   - Use `git diff HEAD` or `git diff --staged` to find changes

2. **Analyze code quality:**
   - Look for code duplication and opportunities to extract shared utilities
   - Identify overly complex functions that could be simplified
   - Check for unnecessary abstractions or over-engineering
   - Find potential performance issues
   - Verify error handling completeness

3. **Suggest improvements:**
   - Provide specific refactoring suggestions with code examples
   - Prioritize suggestions by impact (high/medium/low)
   - Explain the trade-offs of each suggestion

4. **Apply fixes:**
   - With user approval, apply the suggested improvements
   - Verify the code still works after changes
