#!/usr/bin/env bash

set -uo pipefail

usage() {
    cat <<'EOF'
Usage:
  ./copy-codebase.sh [-o OUTPUT.txt] PATH [PATH ...]

Examples:
  ./copy-codebase.sh backend frontend/src
  ./copy-codebase.sh -o copilot-context.txt backend/apps frontend/src
  ./copy-codebase.sh -o context.txt backend/config/settings.py frontend/src

Behavior:
  - PATH arguments may be files or directories.
  - Directories are processed recursively.
  - Each file is preceded by its Git-repository-relative path.
  - Git-ignored and untracked files are excluded by default.
  - Binary files are skipped.
  - The output file itself is excluded.
EOF
}

die() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

output="codebase-context.txt"

while getopts ":o:h" option; do
    case "$option" in
        o) output="$OPTARG" ;;
        h)
            usage
            exit 0
            ;;
        :)
            die "Option -$OPTARG requires a value."
            ;;
        \?)
            die "Unknown option: -$OPTARG"
            ;;
    esac
done

shift $((OPTIND - 1))

(( $# > 0 )) || {
    usage >&2
    exit 1
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" ||
    die "Run this script from inside a Git repository."

cd "$repo_root" || die "Could not enter repository root."

# Convert output to an absolute path before creating it.
if [[ "$output" = /* ]]; then
    output_abs="$output"
else
    output_abs="$PWD/$output"
fi

mkdir -p "$(dirname "$output_abs")" ||
    die "Could not create the output directory."

temp_file="$(mktemp)" || die "Could not create a temporary file."
trap 'rm -f "$temp_file"' EXIT

declare -A seen=()
files=()

add_file() {
    local file="$1"
    local relative

    relative="$(git ls-files --full-name -- "$file" 2>/dev/null | head -n 1)"

    # Skip files that are not tracked by Git.
    [[ -n "$relative" ]] || return 0

    # Skip duplicate paths and the output file.
    [[ -z "${seen[$relative]+x}" ]] || return 0
    [[ "$repo_root/$relative" != "$output_abs" ]] || return 0

    seen["$relative"]=1
    files+=("$relative")
}

for input in "$@"; do
    [[ -e "$input" ]] || {
        printf 'Warning: path not found, skipping: %s\n' "$input" >&2
        continue
    }

    if [[ -f "$input" ]]; then
        add_file "$input"
    elif [[ -d "$input" ]]; then
        while IFS= read -r -d '' file; do
            add_file "$file"
        done < <(git ls-files -z -- "$input")
    else
        printf 'Warning: unsupported path type, skipping: %s\n' "$input" >&2
    fi
done

(( ${#files[@]} > 0 )) ||
    die "No tracked files were found in the supplied paths."

for relative in "${files[@]}"; do
    file="$repo_root/$relative"

    if grep -Iq . "$file" || [[ ! -s "$file" ]]; then
        {
            printf '\n'
            printf '================================================================================\n'
            printf 'FILE: %s\n' "$relative"
            printf '================================================================================\n'
            cat -- "$file"

            # Ensure the next header does not join the last line of the file.
            [[ ! -s "$file" || "$(tail -c 1 "$file" 2>/dev/null)" == $'\n' ]] ||
                printf '\n'
        } >> "$temp_file"
    else
        printf 'Skipping binary file: %s\n' "$relative" >&2
    fi
done

mv -- "$temp_file" "$output_abs"
trap - EXIT

printf 'Created: %s\n' "$output_abs"
printf 'Included files: %d\n' "${#files[@]}"
