; Before checking if the app is running, ask it to quit gracefully.
; The app uses Electron's single-instance lock: launching it with --quit
; triggers the second-instance handler which calls app.quit() cleanly.
; This shuts down the Express server and releases all file handles properly.

!macro customInit
  ; 1. Ask the running instance to quit gracefully via --quit flag.
  ;    $INSTDIR is set by initMultiUser (runs before customInit) on updates.
  nsExec::ExecToLog '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --quit'
  Pop $R0
  ; 2. Give the app time to shut down cleanly (server + DB + Electron processes).
  Sleep 3000
  ; 3. Force-kill any remaining processes (GPU helper, renderer helper, etc.).
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "${PRODUCT_FILENAME}*.exe" /T'
  Pop $R0
  Sleep 2000
!macroend

!macro customCheckAppRunning
  ; App already quit in customInit. Kill any survivors and proceed without dialog.
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "${PRODUCT_FILENAME}*.exe" /T'
  Pop $R0
  Sleep 1000
!macroend
