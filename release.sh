#!/bin/bash

# Dculus Forms Release Script
# Automatically increments version, commits, tags, and pushes

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to extract version from README.md
get_current_version() {
    # Look for version pattern in README.md (handles both standalone and code block)
    grep -o "v[0-9]\+\.[0-9]\+\.[0-9]\+" README.md | head -1 | sed 's/^v//'
}

# Function to increment version
increment_version() {
    local version=$1
    local bump_type=$2
    
    IFS='.' read -r major minor patch <<< "$version"
    
    case $bump_type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            print_error "Invalid bump type: $bump_type"
            exit 1
            ;;
    esac
    
    echo "$major.$minor.$patch"
}

# Function to update version in README.md
update_readme_version() {
    local new_version=$1
    
    # Use sed to replace the first occurrence of version pattern
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - replace first occurrence of version pattern
        sed -i '' "s/v[0-9]\+\.[0-9]\+\.[0-9]\+/v$new_version/" README.md
    else
        # Linux - replace first occurrence of version pattern
        sed -i "s/v[0-9]\+\.[0-9]\+\.[0-9]\+/v$new_version/" README.md
    fi
}

# Main script
main() {
    print_info "Dculus Forms Release Script"
    echo ""
    
    # Check if working directory is clean
    if [[ -n $(git status -s) ]]; then
        print_warning "You have uncommitted changes:"
        git status -s
        echo ""
        read -p "Do you want to commit these changes? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            read -p "Enter commit message: " commit_message
            git add .
            git commit -m "$commit_message"
            print_success "Changes committed"
        else
            print_error "Please commit or stash your changes before creating a release"
            exit 1
        fi
    fi
    
    # Get current version
    current_version=$(get_current_version)
    if [[ -z "$current_version" ]]; then
        print_error "Could not find version in README.md"
        exit 1
    fi
    
    print_info "Current version: v$current_version"
    echo ""
    
    # Ask for bump type
    echo "Select version bump type:"
    echo "  1) patch (v$current_version -> v$(increment_version "$current_version" "patch"))"
    echo "  2) minor (v$current_version -> v$(increment_version "$current_version" "minor"))"
    echo "  3) major (v$current_version -> v$(increment_version "$current_version" "major"))"
    echo "  4) custom version"
    echo "  5) cancel"
    echo ""
    read -p "Enter choice [1-5]: " choice
    
    case $choice in
        1)
            bump_type="patch"
            new_version=$(increment_version "$current_version" "$bump_type")
            ;;
        2)
            bump_type="minor"
            new_version=$(increment_version "$current_version" "$bump_type")
            ;;
        3)
            bump_type="major"
            new_version=$(increment_version "$current_version" "$bump_type")
            ;;
        4)
            read -p "Enter custom version (e.g., 1.2.3): " new_version
            # Validate version format
            if ! [[ $new_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                print_error "Invalid version format. Must be X.Y.Z"
                exit 1
            fi
            ;;
        5)
            print_info "Release cancelled"
            exit 0
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    echo ""
    print_info "New version will be: v$new_version"
    echo ""
    
    # Confirm release
    read -p "Proceed with release? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Release cancelled"
        exit 0
    fi
    
    echo ""
    print_info "Creating release v$new_version..."
    echo ""
    
    # Update README.md
    print_info "Updating version in README.md..."
    update_readme_version "$new_version"
    print_success "README.md updated"
    
    # Commit version change
    print_info "Committing version change..."
    git add README.md
    git commit -m "chore: bump version to v$new_version"
    print_success "Version change committed"
    
    # Create annotated tag
    print_info "Creating git tag v$new_version..."
    git tag -a "v$new_version" -m "Release v$new_version"
    print_success "Tag created"
    
    # Push changes and tag
    print_info "Pushing to remote..."
    git push origin main
    git push origin "v$new_version"
    print_success "Pushed to remote"
    
    echo ""
    print_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_success "Release v$new_version created successfully!"
    print_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    print_info "GitHub Actions workflow will now:"
    echo "  • Build all frontend applications"
    echo "  • Create release artifacts"
    echo "  • Deploy infrastructure via Terraform"
    echo "  • Deploy applications to Cloudflare Pages"
    echo ""
    print_info "Monitor deployment at:"
    echo "  https://github.com/dculussoftwares/dculus-forms/actions"
    echo ""
}

# Run main function
main
