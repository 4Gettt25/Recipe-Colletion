!include "LogicLib.nsh"

; ─────────────────────────────────────────────────────────────────────────────
; WaitForInstDirUnlocked  uniqueId  maxRetries  sleepMs
;
; Tries to create (and immediately delete) a probe file inside $INSTDIR.
; If anything—AV scanner, NGenuity, Defender—holds the directory or its files
; in a way that blocks write access, the open fails and the loop waits.
; Exits as soon as the write succeeds or maxRetries is exhausted.
;
; uniqueId must be a distinct plain string per call site (no spaces/dots).
; ─────────────────────────────────────────────────────────────────────────────
!macro WaitForInstDirUnlocked uniqueId maxRetries sleepMs
  Push $0
  Push $1

  StrCpy $0 0
  unlock_loop_${uniqueId}:
    IntCmp $0 ${maxRetries} unlock_done_${uniqueId} unlock_done_${uniqueId} +1

    ClearErrors
    CreateDirectory "$INSTDIR"
    FileOpen $1 "$INSTDIR\.__unlock_test" w
    ${IfNot} ${Errors}
      FileClose $1
      Delete "$INSTDIR\.__unlock_test"
      Goto unlock_done_${uniqueId}
    ${EndIf}

    DetailPrint "Waiting for install directory to be available... (attempt $0/${maxRetries})"
    Sleep ${sleepMs}
    IntOp $0 $0 + 1
    Goto unlock_loop_${uniqueId}

  unlock_done_${uniqueId}:
  Pop $1
  Pop $0
!macroend

; ── 1. preInit ───────────────────────────────────────────────────────────────
; Very first hook — fires at the top of .onInit before any GUI.
!macro preInit
  nsExec::ExecToLog 'taskkill /F /IM "Recipe Collection.exe"'
  Pop $R0
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Stop-Process -Name ''Recipe Collection'' -Force -ErrorAction SilentlyContinue"'
  Pop $R0
  Sleep 2000
!macroend

; ── 2. customInit ────────────────────────────────────────────────────────────
; Runs after initMultiUser has already set $INSTDIR from INSTALL_REGISTRY_KEY.
;
; Strategy A — registry bypass (fixes v1.0.3 → current path):
;   Delete ${UNINSTALL_REGISTRY_KEY} so that uninstallOldVersion() finds no
;   UninstallString and returns immediately without running the old uninstaller.
;   The old uninstaller is what triggers NGenuity to re-scan the install dir,
;   causing rename failures inside un.atomicRMDir. Skipping it entirely avoids
;   the problem. $INSTDIR is unaffected (set from the separate INSTALL_REGISTRY_KEY).
;
; Strategy B — directory lock wait (extra safety):
;   Retry-loop that writes a probe file to $INSTDIR. Catches any residual
;   lock held by NGenuity or other security software.
!macro customInit
  nsExec::ExecToLog 'taskkill /F /IM "Recipe Collection.exe"'
  Pop $R0
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Stop-Process -Name ''Recipe Collection'' -Force -ErrorAction SilentlyContinue"'
  Pop $R0
  Sleep 1000

  ; Strategy A: bypass old uninstaller by wiping its registry entries.
  DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY_2}"
    DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY_2}"
  !endif

  ; Strategy B: wait for the install directory to accept writes (40 × 500 ms = 20 s max).
  !insertmacro WaitForInstDirUnlocked "ci" 40 500
!macroend

; ── 3. customUnInit ──────────────────────────────────────────────────────────
; Runs inside THIS version's uninstaller — including when a FUTURE version's
; installer invokes it silently. Waiting here ensures that by the time
; un.atomicRMDir() tries to rename files, all scanner handles are released.
; (For older uninstallers that don't have this macro, Strategy A is the fix.)
!macro customUnInit
  !insertmacro WaitForInstDirUnlocked "cu" 40 500
!macroend

; ── 4. customCheckAppRunning ─────────────────────────────────────────────────
; Replaces electron-builder's built-in "please close the app" dialog entirely.
; With this macro defined, no dialog is ever shown; we kill and continue.
!macro customCheckAppRunning
  nsExec::ExecToLog 'taskkill /F /IM "Recipe Collection.exe"'
  Pop $R0
  nsExec::ExecToLog 'powershell.exe -NonInteractive -WindowStyle Hidden -Command "Stop-Process -Name ''Recipe Collection'' -Force -ErrorAction SilentlyContinue"'
  Pop $R0
  Sleep 2000
!macroend
