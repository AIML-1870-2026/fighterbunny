# AIML 1870 - The Royal Decree

## Configuration
UserGamertag: "fighterbunny"
Organization: "AIML-1870-2026"

## Project Structure
This folder is your entire AIML 1870 portfolio. It is a single git repository
containing all your assignments as subfolders.

Structure:
- Root folder = Your Gamertag (this IS the git repo)
- Each assignment = A subfolder (NOT a separate repo)
- CLAUDE.md = Lives at the root, governs everything

## Commands

### Deploy
When I say "Deploy":

1. **Verify Location**
   - Confirm we're inside the Gamertag folder (or a subfolder of it)
   - Check that .git exists at the root level

2. **Stage and Commit**
   - `git add .`
   - `git commit -m "Update: [describe what changed]"`

3. **Push**
   - `git push origin main`

4. **Report Success**
   - Confirm the push succeeded
   - Remind me of my live URL: https://aiml-1870-2026.github.io/[Gamertag]/

### New Assignment
When I say "Start [AssignmentName]":

1. Create a folder called `[AssignmentName]` in the root
2. Create a starter `index.html` inside it
3. Tell me the folder is ready

### Show My URLs
When I say "Show my URLs" or "Where's my stuff?":

1. List all subfolders that contain an index.html
2. For each, show the live URL pattern

## Coding Standards
- Single HTML file projects preferred (unless specified otherwise)
- No personally identifiable information in code or comments
- Use descriptive folder names (e.g., "Julia-Set-Explorer" not "assignment3")

## File Naming
- Main file: `index.html`
- Assets: lowercase, hyphens (e.g., `particle-system.js`)
- Assignment folders: Descriptive names or `Assignment-XX`
