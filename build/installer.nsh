; When "Install now" is clicked, the app calls app.quit() and electron-updater
; launches the installer only AFTER the process tree is fully gone
; (autoInstallOnAppQuit:true). By the time customInit runs, Recipe Collection
; should already be closed. The taskkill below is a safety net for any
; survivors (e.g. a GPU helper that didn't exit cleanly).
;
; Notes:
;   - taskkill /IM does NOT support wildcards — use the exact exe name.
;   - /T (kill tree) is omitted intentionally: if the main process is already
;     dead its helpers have been re-parented, so /T would miss them.
;     Without /T, taskkill kills EVERY process with the matching image name.

!macro customInit
  ; Safety net: force-kill any surviving Electron processes by exact name.
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}"'
  Pop $R0
  Sleep 2000
!macroend

!macro customCheckAppRunning
  ; Called on Retry — kill survivors so the install proceeds without the dialog.
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}"'
  Pop $R0
  Sleep 1000
!macroend
