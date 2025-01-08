#!/usr/bin/env python3
import git_filter_repo
import re
from typing import Optional

# Regex patterns for sensitive information
PATTERNS = {
    'openai_api_key': (
        r'sk-[a-zA-Z0-9]{48}',
        '<OPENAI-API-KEY>'
    ),
    'aws_access_key_id': (
        r'AKIA[A-Z0-9]{16}',
        '<AWS-ACCESS-KEY-ID>'
    ),
    'aws_secret_key': (
        r'[A-Za-z0-9+/]{40}',  # Base64 encoded secret key
        '<AWS-SECRET-KEY>'
    )
}

def clean_sensitive_data(blob, _):
    data = blob.data.decode('utf-8', errors='replace')
    original_data = data
    
    for pattern, replacement in PATTERNS.values():
        data = re.sub(pattern, replacement, data)
    
    # Only modify blob if changes were made
    if data != original_data:
        blob.data = data.encode('utf-8')

def main():
    print("WARNING: This script will rewrite git history.")
    print("Make sure you have a backup before proceeding!")
    input("Press Enter to continue or Ctrl+C to abort...")

    try:
        # Initialize the filter
        args = git_filter_repo.FilteringOptions.default_options()
        args.force = True
        
        filter_repo = git_filter_repo.RepoFilter(
            blob_callback=clean_sensitive_data,
            args=args
        )
        
        filter_repo.run()
        
        print("\nComplete! Please verify the changes and then force push:")
        print("git push origin --force --all")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        print("\nMake sure you:")
        print("1. Have git-filter-repo installed")
        print("2. Run this script from the root of your git repository")
        print("3. Have a clean working directory (commit or stash changes)")

if __name__ == "__main__":
    main()

