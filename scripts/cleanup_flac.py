#!/usr/bin/env python3
"""
Delete FLAC files where there's an MP3 with the same name.

This script recursively searches a directory for .flac files and deletes them
if a corresponding .mp3 file with the same base name exists.
"""

import os
import sys
import argparse
from pathlib import Path


def cleanup_flac(directory, dry_run=False, verbose=False):
    """
    Find and delete FLAC files that have corresponding MP3 files.
    
    Args:
        directory: Path to the directory to search
        dry_run: If True, only print what would be deleted without actually deleting
        verbose: If True, print detailed information about each file
    
    Returns:
        Tuple of (deleted_count, skipped_count)
    """
    deleted_count = 0
    skipped_count = 0
    
    dir_path = Path(directory)
    
    if not dir_path.exists():
        print(f"Error: Directory '{directory}' does not exist.")
        return (0, 0)
    
    if not dir_path.is_dir():
        print(f"Error: '{directory}' is not a directory.")
        return (0, 0)
    
    # Recursively find all .flac files
    flac_files = list(dir_path.rglob("*.flac"))
    
    if not flac_files:
        print(f"No FLAC files found in '{directory}'")
        return (0, 0)
    
    print(f"Found {len(flac_files)} FLAC file(s) to check...")
    
    for flac_file in flac_files:
        # Create the corresponding MP3 filename
        mp3_file = flac_file.with_suffix(".mp3")
        
        if mp3_file.exists():
            if verbose or dry_run:
                print(f"{'[DRY RUN] ' if dry_run else ''}Deleting: {flac_file}")
                print(f"  (MP3 exists: {mp3_file})")
            
            if not dry_run:
                try:
                    flac_file.unlink()
                    deleted_count += 1
                    if verbose:
                        print(f"  ✓ Deleted successfully")
                except OSError as e:
                    print(f"  ✗ Error deleting {flac_file}: {e}")
                    skipped_count += 1
            else:
                deleted_count += 1
        else:
            if verbose:
                print(f"Skipping: {flac_file} (no corresponding MP3)")
            skipped_count += 1
    
    return (deleted_count, skipped_count)


def main():
    parser = argparse.ArgumentParser(
        description="Delete FLAC files where there's an MP3 with the same name",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run to see what would be deleted
  python cleanup_flac.py /path/to/music --dry-run
  
  # Actually delete the files
  python cleanup_flac.py /path/to/music
  
  # Verbose mode with dry run
  python cleanup_flac.py /path/to/music --dry-run --verbose
        """
    )
    
    parser.add_argument(
        "directory",
        help="Directory to search for FLAC files"
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deleted without actually deleting files"
    )
    
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Print detailed information about each file"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("FLAC Cleanup Script")
    print("=" * 60)
    print(f"Directory: {args.directory}")
    print(f"Mode: {'DRY RUN (no files will be deleted)' if args.dry_run else 'LIVE (files will be deleted)'}")
    print("=" * 60)
    print()
    
    deleted, skipped = cleanup_flac(args.directory, args.dry_run, args.verbose)
    
    print()
    print("=" * 60)
    print("Summary:")
    print(f"  FLAC files {'to be ' if args.dry_run else ''}deleted: {deleted}")
    print(f"  FLAC files skipped (no MP3): {skipped}")
    print("=" * 60)
    
    if args.dry_run and deleted > 0:
        print()
        print("This was a dry run. Run again without --dry-run to actually delete the files.")


if __name__ == "__main__":
    main()
