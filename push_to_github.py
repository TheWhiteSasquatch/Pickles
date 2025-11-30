#!/usr/bin/env python3
"""
Simple script to push local files to a GitHub repository without manual git setup.
This script will initialize git if needed, add the remote, and push all files.
"""

import subprocess
import sys
import os
import hashlib
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

def calculate_file_hash(filepath):
    """Calculate SHA256 hash of a file."""
    hash_sha256 = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            # Read file in chunks to handle large files
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    except FileNotFoundError:
        return None

def get_cached_hash(cache_file):
    """Get cached hash from file."""
    try:
        with open(cache_file, "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        return None

def set_cached_hash(cache_file, hash_value):
    """Store hash in cache file."""
    with open(cache_file, "w") as f:
        f.write(hash_value)

def has_file_changed(filepath, cache_file):
    """Check if file has changed since last cache."""
    current_hash = calculate_file_hash(filepath)
    if current_hash is None:
        return True  # File doesn't exist, consider it changed

    cached_hash = get_cached_hash(cache_file)
    return current_hash != cached_hash

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

    # Add files (excluding development files)
    print("📦 Adding files...")
    # Add specific files, excluding development files
    files_to_add = [
        "README.md",
        "Kick_Stream_Monitor.user.js",
        "image (20).jpg",
        "incoming.mp3",
        "channels.json",
        "Kick_Stream_Monitor_Plan.md",
        "push_to_github.py"
    ]

    # Check which files exist and have changed
    files_to_commit = []

    # Special handling for MP3 file with caching
    mp3_file = "incoming.mp3"
    mp3_cache_file = ".mp3_cache"

    if os.path.exists(mp3_file):
        if has_file_changed(mp3_file, mp3_cache_file):
            print(f"📁 MP3 file has changed, will upload: {mp3_file}")
            files_to_commit.append(mp3_file)
            # Update cache with new hash
            current_hash = calculate_file_hash(mp3_file)
            if current_hash:
                set_cached_hash(mp3_cache_file, current_hash)
        else:
            print(f"✅ MP3 file unchanged, skipping: {mp3_file}")
    else:
        print(f"⚠️  MP3 file not found: {mp3_file}")

    # Handle other files (always add them as they're likely small and change frequently)
    for file in files_to_add:
        if file == mp3_file:
            continue  # Already handled above
        if os.path.exists(file):
            files_to_commit.append(file)

    if files_to_commit:
        # Properly quote filenames to handle spaces and special characters
        quoted_files = [f'"{file}"' for file in files_to_commit]
        run_command(f"git add { ' '.join(quoted_files) }")
        print(f"📦 Added {len(files_to_commit)} file(s) to git")
    else:
        print("⚠️  No files to add")

    # Check if there are staged changes to commit
    stdout, stderr = run_command("git diff --cached --name-only", check=False)
    if not stdout.strip():
        print("ℹ️  No changes staged to commit")
        # Check if there are commits to push
        stdout, stderr = run_command("git log --oneline origin/master..HEAD", check=False)
        if not stdout.strip():
            print("ℹ️  No commits to push")
            return
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
