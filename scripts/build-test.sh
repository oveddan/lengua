#!/bin/bash

# Build and test script for Spanish Flashcards app

set -e

echo "=== Building Spanish Flashcards ==="
echo ""

# Check if better-sqlite3 is built
if [ ! -f "node_modules/better-sqlite3/build/Release/better_sqlite3.node" ]; then
  echo "Building better-sqlite3..."
  cd node_modules/better-sqlite3 && npm run build-release && cd ../..
fi

# Run lint
echo "Running lint..."
pnpm lint || echo "Lint warnings (continuing...)"

# Build
echo ""
echo "Building Next.js..."
pnpm build

echo ""
echo "=== Build Complete ==="
echo ""
echo "To start the app:"
echo "  pnpm dev     # Development mode"
echo "  pnpm start   # Production mode (after build)"
echo ""
echo "Quick test commands:"
echo "  pnpm test:db                    # Test database"
echo "  pnpm test:translate hola        # Test translation"
echo "  pnpm sentence \"your sentence\"   # Analyze a sentence"
