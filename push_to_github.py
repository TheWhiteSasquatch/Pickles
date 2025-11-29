#!/usr/bin/env python3
"""
Simple script to push local files to a GitHub repository without manual git setup.
This script will initialize git if needed, add the remote, and push all files.
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(command, cwd=None, check=True):
    """Run a shell command and return the result."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=check
        )
        return result.stdout.strip(), result.stderr.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {command}")
        print(f"stdout: {e.stdout}")
        print(f"stderr: {e.stderr}")
        if check:
            sys.exit(1)
        return e.stdout.strip(), e.stderr.strip()

def is_git_repo():
    """Check if current directory is a git repository."""
    stdout, stderr = run_command("git rev-parse --git-dir", check=False)
    return stdout != "" and "not a git repository" not in stderr

def has_remote(remote_name="origin"):
    """Check if remote exists."""
    stdout, stderr = run_command(f"git remote get-url {remote_name}", check=False)
    return "error" not in stderr.lower() and stdout.strip() != ""

def main():
    # Configuration
    repo_url = "https://github.com/TheWhiteSasquatch/Pickles.git"
    commit_message = "Initial commit"

    print("🚀 Starting push to GitHub...")

    # Check if we're in a git repository
    if not is_git_repo():
        print("📁 Initializing git repository...")
        run_command("git init")
    else:
        print("✅ Git repository already initialized")

    # Check/add remote
    if not has_remote():
        print("🔗 Adding remote origin...")
        run_command(f"git remote add origin {repo_url}")
    else:
        print("✅ Remote origin already exists")
        # Update remote URL just in case
        run_command(f"git remote set-url origin {repo_url}")

    # Add all files
    print("📦 Adding files...")
    run_command("git add .")

    # Check if there are changes to commit
    stdout, stderr = run_command("git status --porcelain", check=False)
    if not stdout.strip():
        print("ℹ️  No changes to commit")
        # Still try to push in case there are commits not pushed
    else:
        # Commit changes
        print("💾 Committing files...")
        run_command(f'git commit -m "{commit_message}"')

    # Push to GitHub
    print("⬆️  Pushing to GitHub...")

    # Check current branch name
    current_branch, _ = run_command("git branch --show-current")
    if not current_branch:
        current_branch = "master"  # fallback

    try:
        run_command(f"git push -u origin {current_branch}")
        print("✅ Successfully pushed to GitHub!")
    except SystemExit:
        print("❌ Failed to push. You might need to:")
        print("   1. Set up authentication (personal access token or SSH key)")
        print("   2. Create the repository on GitHub first")
        print("   3. Check your internet connection")

if __name__ == "__main__":
    # Change to the script's directory to work with local files
    script_dir = Path(__file__).parent
    os.chdir(script_dir)

    main()
