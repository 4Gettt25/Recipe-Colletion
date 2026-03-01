; ─────────────────────────────────────────────────────────────────────────────
; Kill "Recipe Collection.exe" before NSIS checks whether the app is running.
; We use three independent hooks so the process is gone long before the
; Section's checkRunning fires, regardless of which Electron update path
; launched the installer (quitAndInstall, app.quit, or a manual run).
;
; Process-kill strategy
;   1. taskkill  — fast, built-in, kills by exact image name
;   2. PowerShell Stop-Process  — catches edge cases taskkill misses
;   Both are run without the full $SYSDIR path to avoid SysWOW64 redirect
;   issues on some 64-bit systems.
;
; Macro call order (electron-builder):
;   preInit  → very first thing (before GUI, before .onInit)
;   customInit  → inside .onInit
;   customCheckAppRunning  → replaces the default "please close" dialog in
;     the install Section; if this macro is defined the dialog is never shown.
; ─────────────────────────────────────────────────────────────────────────────

; ── 1. preInit ───────────────────────────────────────────────────────────────
; Earliest possible hook. Gives the kill maximum time to complete before
; the checkRunning call in the install Section.
!macro preInit
  nsExec::ExecToLog 'taskkill /F /IM "Recipe Collection.exe"'
  Pop $R0
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Stop-Process -Name ''Recipe Collection'' -Force -ErrorAction SilentlyContinue"'
  Pop $R0
  Sleep 4000
!macroend

; ── 2. customInit ────────────────────────────────────────────────────────────
; Runs in .onInit, after preInit. Second chance to kill before pages load.
!macro customInit
  nsExec::ExecToLog 'taskkill /F /IM "Recipe Collection.exe"'
  Pop $R0
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Stop-Process -Name ''Recipe Collection'' -Force -ErrorAction SilentlyContinue"'
  Pop $R0
  Sleep 2000
!macroend

; ── 3. customCheckAppRunning ─────────────────────────────────────────────────
; Replaces electron-builder's default running-app dialog entirely.
; If this macro is defined, no "cannot close" dialog is ever shown;
; we kill silently and installation continues.
!macro customCheckAppRunning
  nsExec::ExecToLog 'taskkill /F /IM "Recipe Collection.exe"'
  Pop $R0
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Stop-Process -Name ''Recipe Collection'' -Force -ErrorAction SilentlyContinue"'
  Pop $R0
  Sleep 3000
!macroend
