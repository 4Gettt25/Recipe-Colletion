; ─────────────────────────────────────────────────────────────────────────────
; Fix for "Recipe Collection cannot be closed" dialog during auto-update.
;
; ROOT CAUSE (discovered v1.0.9):
;   The new installer's uninstallOldVersion() runs the OLD version's uninstaller
;   silently. The old uninstaller's un.checkAppRunning sleeps 3 s after killing
;   the process. During that sleep, NGenuity2Helper.exe (HP OMEN software) re-
;   acquires a file handle on Recipe Collection.exe without FILE_SHARE_DELETE.
;   When un.atomicRMDir() then tries to rename/move the exe, Windows refuses
;   (sharing violation). After 5 failed uninstaller runs, NSIS shows the
;   misleading "appCannotBeClosed" dialog even though the app is NOT running.
;
; FIX (customInit):
;   Delete the ${UNINSTALL_REGISTRY_KEY} entries in customInit (which runs
;   inside .onInit, after $INSTDIR is already set from ${INSTALL_REGISTRY_KEY}).
;   When uninstallOldVersion() reads the registry and finds no UninstallString,
;   it returns immediately without launching the old uninstaller.
;   The new installer then overwrites files directly — no lock issues.
;
;   ${INSTALL_REGISTRY_KEY}   — has InstallLocation (already read into $INSTDIR)
;   ${UNINSTALL_REGISTRY_KEY} — has UninstallString (what we delete here)
;   These are separate keys, so $INSTDIR is unaffected.
;
; RETAINED KILLS (preInit + customCheckAppRunning):
;   Belt-and-suspenders: kill any lingering Recipe Collection.exe process so
;   the new installer can overwrite the exe files.
; ─────────────────────────────────────────────────────────────────────────────

; ── 1. preInit ───────────────────────────────────────────────────────────────
; Earliest hook — runs at the very top of .onInit, before any GUI.
!macro preInit
  nsExec::ExecToLog 'taskkill /F /IM "Recipe Collection.exe"'
  Pop $R0
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Stop-Process -Name ''Recipe Collection'' -Force -ErrorAction SilentlyContinue"'
  Pop $R0
  Sleep 2000
!macroend

; ── 2. customInit ────────────────────────────────────────────────────────────
; Runs after initMultiUser has already set $INSTDIR from INSTALL_REGISTRY_KEY.
; We delete the UNINSTALL_REGISTRY_KEY so that uninstallOldVersion() finds no
; UninstallString and returns early — bypassing the old uninstaller entirely.
!macro customInit
  nsExec::ExecToLog 'taskkill /F /IM "Recipe Collection.exe"'
  Pop $R0
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Stop-Process -Name ''Recipe Collection'' -Force -ErrorAction SilentlyContinue"'
  Pop $R0
  Sleep 1000

  ; ── Bypass old uninstaller (NGenuity lock fix) ──────────────────────────
  ; Delete the standard Windows uninstall registry entries so that
  ; uninstallOldVersion() short-circuits and never runs the old .exe.
  ; $INSTDIR is already set (from INSTALL_REGISTRY_KEY) and stays correct.
  DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY_2}"
    DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY_2}"
  !endif
!macroend

; ── 3. customCheckAppRunning ─────────────────────────────────────────────────
; Replaces the built-in "please close the app" dialog in the install Section.
; With this macro defined the dialog is NEVER shown; we kill and continue.
!macro customCheckAppRunning
  nsExec::ExecToLog 'taskkill /F /IM "Recipe Collection.exe"'
  Pop $R0
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Stop-Process -Name ''Recipe Collection'' -Force -ErrorAction SilentlyContinue"'
  Pop $R0
  Sleep 2000
!macroend
