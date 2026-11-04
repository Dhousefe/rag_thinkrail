@echo off
REM =============================================================================
REM ThinkRail - Cindy MCP Server Launcher
REM =============================================================================
setlocal enabledelayedexpansion

cd /d "%~dp0.."
bun apps/cli/scripts/cindy-mcp-server.ts %*
