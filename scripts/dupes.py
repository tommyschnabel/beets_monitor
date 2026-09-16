import os
import re
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def find_and_replace_numbered_mp3s(directory, dry_run=False, keep_others=False, no_confirm=False, no_backup=False):
    """
    Find and replace numbered MP3 files with their highest numbered version.
    
    Args:
        directory: Path to directory to process
        dry_run: If True, only show what would be done without making changes
        keep_others: If True, keep other numbered files after replacement (default is to delete them)
        no_confirm: If True, skip confirmation prompts
        no_backup: If True, skip creating backups of original files
    """
    # Validate directory exists
    directory_path = Path(directory)
    if not directory_path.exists():
        logger.error(f"Directory {directory} does not exist")
        return False
    
    if not directory_path.is_dir():
        logger.error(f"{directory} is not a directory")
        return False
    
    # Dictionary to store base names and their numbered files
    numbered_files: Dict[str, List[Tuple[str, str]]] = {}
    
    # Walk through directory recursively
    logger.info(f"Scanning directory: {directory}")
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.lower().endswith('.mp3'):
                file_path = Path(root) / file
                
                # Skip symlinks
                if file_path.is_symlink():
                    logger.debug(f"Skipping symlink: {file_path}")
                    continue
                
                # Extract base name without number suffix
                base_name = re.sub(r'\.\d+\.mp3$', '.mp3', file)
                if base_name != file:  # This is a numbered file
                    if base_name not in numbered_files:
                        numbered_files[base_name] = []
                    numbered_files[base_name].append((file, root))
    
    if not numbered_files:
        logger.info("No numbered MP3 files found")
        return True
    
    logger.info(f"Found {len(numbered_files)} base names with numbered files")
    
    # Process each base name
    changes_made: List[Dict] = []
    for base_name, files in numbered_files.items():
        # Find highest numbered file
        max_number = -1
        highest_file: Optional[str] = None
        highest_root: Optional[str] = None
        
        for file, root in files:
            match = re.search(r'\.(\d+)\.mp3$', file)
            if match:
                number = int(match.group(1))
                if number > max_number:
                    max_number = number
                    highest_file = file
                    highest_root = root
        
        if highest_file and highest_root:
            # Get the full paths
            highest_file_path = Path(highest_root) / highest_file
            
            # Find where the base file actually exists (if anywhere)
            base_file_path = None
            for walk_root, walk_dirs, walk_files in os.walk(directory):
                potential_base = Path(walk_root) / base_name
                if potential_base.exists() and not potential_base.is_symlink():
                    base_file_path = potential_base
                    break
            
            # If base file doesn't exist, use the same directory as highest file
            if base_file_path is None:
                base_file_path = Path(highest_root) / base_name
            
            changes_made.append({
                'base_name': base_name,
                'base_file_path': base_file_path,
                'highest_file_path': highest_file_path,
                'highest_file': highest_file,
                'other_files': [(f, r) for f, r in files if f != highest_file]
            })
    
    # Display changes to be made
    if not changes_made:
        logger.info("No changes needed")
        return True
    
    logger.info("\n" + "="*80)
    logger.info("CHANGES TO BE MADE:")
    logger.info("="*80)
    for change in changes_made:
        logger.info(f"\nBase file: {change['base_name']}")
        logger.info(f"  Will replace: {change['base_file_path']}")
        logger.info(f"  With: {change['highest_file_path']}")
        if change['other_files']:
            logger.info(f"  Other numbered files ({len(change['other_files'])}):")
            for other_file, other_root in change['other_files']:
                logger.info(f"    - {Path(other_root) / other_file}")
    
    logger.info("\n" + "="*80)
    
    # Ask for confirmation unless dry_run or no_confirm
    if not dry_run and not no_confirm:
        response = input("\nDo you want to proceed with these changes? (yes/no): ").strip().lower()
        if response not in ['yes', 'y']:
            logger.info("Operation cancelled by user")
            return False
    
    # Process changes
    success_count = 0
    error_count = 0
    
    for change in changes_made:
        base_file_path = change['base_file_path']
        highest_file_path = change['highest_file_path']
        base_name = change['base_name']
        
        if dry_run:
            logger.info(f"[DRY RUN] Would replace {base_name} with {change['highest_file']}")
            if not keep_others and change['other_files']:
                for other_file, other_root in change['other_files']:
                    logger.info(f"[DRY RUN] Would delete {Path(other_root) / other_file}")
            success_count += 1
            continue
        
        try:
            # Create backup of original if it exists (unless no_backup is True)
            backup_path = None
            if base_file_path.exists() and not no_backup:
                # Create timestamped backup
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                backup_path = base_file_path.with_suffix(f'.mp3.backup_{timestamp}')
                
                # Check if backup already exists
                if backup_path.exists():
                    logger.warning(f"Backup file already exists: {backup_path}")
                    response = input(f"Overwrite existing backup? (yes/no): ").strip().lower()
                    if response not in ['yes', 'y']:
                        logger.info(f"Skipping {base_name} due to existing backup")
                        continue
                
                logger.info(f"Creating backup: {backup_path}")
                os.rename(base_file_path, backup_path)
            elif base_file_path.exists() and no_backup:
                logger.info(f"Skipping backup for {base_name} (--no-backup flag set)")
            
            # Replace original with highest numbered file
            logger.info(f"Replacing {base_name} with {change['highest_file']}")
            os.rename(highest_file_path, base_file_path)
            success_count += 1
            
            # Delete other numbered files (unless keep_others is True)
            if not keep_others and change['other_files']:
                for other_file, other_root in change['other_files']:
                    other_path = Path(other_root) / other_file
                    try:
                        logger.info(f"Deleting: {other_path}")
                        other_path.unlink()
                    except PermissionError as e:
                        logger.error(f"Permission denied deleting {other_path}: {e}")
                        error_count += 1
                    except OSError as e:
                        logger.error(f"Error deleting {other_path}: {e}")
                        error_count += 1
            
        except PermissionError as e:
            logger.error(f"Permission denied processing {base_name}: {e}")
            error_count += 1
            # Restore backup if it exists
            if backup_path and backup_path.exists():
                try:
                    os.rename(backup_path, base_file_path)
                    logger.info(f"Restored backup: {base_file_path}")
                except OSError as restore_error:
                    logger.error(f"Failed to restore backup: {restore_error}")
        except OSError as e:
            logger.error(f"Error processing {base_name}: {e}")
            error_count += 1
            # Restore backup if it exists
            if backup_path and backup_path.exists():
                try:
                    os.rename(backup_path, base_file_path)
                    logger.info(f"Restored backup: {base_file_path}")
                except OSError as restore_error:
                    logger.error(f"Failed to restore backup: {restore_error}")
        except Exception as e:
            logger.error(f"Unexpected error processing {base_name}: {e}")
            error_count += 1
            # Restore backup if it exists
            if backup_path and backup_path.exists():
                try:
                    os.rename(backup_path, base_file_path)
                    logger.info(f"Restored backup: {base_file_path}")
                except OSError as restore_error:
                    logger.error(f"Failed to restore backup: {restore_error}")
    
    logger.info("\n" + "="*80)
    logger.info(f"SUMMARY: {success_count} files processed successfully, {error_count} errors")
    logger.info("="*80)
    
    return error_count == 0


def main():
    parser = argparse.ArgumentParser(
        description='Find and replace numbered MP3 files with their highest numbered version.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s /path/to/music
  %(prog)s /path/to/music --dry-run
  %(prog)s /path/to/music --keep-others --no-confirm
  %(prog)s /path/to/music --dry-run --keep-others
  %(prog)s /path/to/music --no-backup --no-confirm
        """
    )
    
    parser.add_argument(
        'directory',
        help='Directory path to process'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )
    
    parser.add_argument(
        '--keep-others',
        action='store_true',
        help='Keep other numbered files after replacement (default is to delete them)'
    )
    
    parser.add_argument(
        '--no-backup',
        action='store_true',
        help='Skip creating backups of original files'
    )
    
    parser.add_argument(
        '--no-confirm',
        action='store_true',
        help='Skip confirmation prompts'
    )
    
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    # Set logging level
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # Run the main function
    success = find_and_replace_numbered_mp3s(
        args.directory,
        dry_run=args.dry_run,
        keep_others=args.keep_others,
        no_confirm=args.no_confirm,
        no_backup=args.no_backup
    )
    
    if not success:
        exit(1)


if __name__ == "__main__":
    main()
