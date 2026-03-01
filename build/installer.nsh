; Kill the running instance before installation to prevent the
; "Recipe Collection kann nicht geschlossen werden" dialog.
;
; Root cause: taskkill /IM does NOT support wildcards. The old pattern
; "${PRODUCT_FILENAME}*.exe" always failed silently, leaving Electron helper
; processes (renderer, GPU, network service) alive. NSIS then detected the
; app as still running and showed the manual-close dialog.
;
; Fix: use the exact executable name ${APP_EXECUTABLE_FILENAME} ("Recipe Collection.exe").
; All Electron sub-processes share that name, so /F /T kills the whole tree.

!macro customInit
  ; 1. Ask the live instance to quit gracefully via the --quit flag.
  ;    The single-instance lock relays it to the running app, which sets
  ;    isQuitting=true and calls app.quit() cleanly (closes server + DB).
  nsExec::ExecToLog '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --quit'
  Pop $R0
  ; Give Electron time to shut down the Express server and release file handles.
  Sleep 3000

  ; 2. Force-kill any surviving processes by EXACT name (no wildcard).
  ;    /T kills the entire process tree (renderer, GPU helper, network service).
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Pop $R0
  Sleep 1500
!macroend

!macro customCheckAppRunning
  ; Called when the user clicks "Wiederholen / Retry" after the dialog appears.
  ; Kill survivors with the exact name so the install proceeds immediately.
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Pop $R0
  Sleep 1000
!macroend
