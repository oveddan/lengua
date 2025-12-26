#!/bin/bash

# Check for errors in the dev server logs
LOG_FILE="/tmp/claude/-Users-danoved-Source-spanish-anki/tasks/be44538.output"

if [ ! -f "$LOG_FILE" ]; then
  echo "Log file not found: $LOG_FILE"
  exit 1
fi

echo "=== Recent Errors ==="
grep -A 10 "SyntaxError\|Error\|error\|500\|stderr" "$LOG_FILE" | tail -30

echo ""
echo "=== Last 5 API calls ==="
grep "POST\|GET" "$LOG_FILE" | tail -5
