#!/usr/bin/env node
// Patches electron-builder's NSIS templates to remove the broken "app is running"
// dialog. Instead, the app is killed early in customInit (.onInit) via build/installer.nsh.

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(__dirname, '../node_modules/app-builder-lib/templates/nsis');

function patch(relPath, oldStr, newStr) {
  const fullPath = join(templatesDir, relPath);
  let content;
  try { content = readFileSync(fullPath, 'utf8'); } catch {
    console.log(`patch-nsis: ${relPath} not found, skipping.`);
    return;
  }
  if (content.includes(newStr.trim().split('\n')[0])) {
    console.log(`patch-nsis: ${relPath} already patched.`);
    return;
  }
  if (!content.includes(oldStr)) {
    console.log(`patch-nsis: ${relPath} format changed — patch may need updating.`);
    return;
  }
  writeFileSync(fullPath, content.replace(oldStr, newStr), 'utf8');
  console.log(`patch-nsis: patched ${relPath}`);
}

// 1. installSection.nsh — remove CHECK_APP_RUNNING from installer
//    (app is killed in customInit before the install section runs)
patch(
  'installSection.nsh',
  `  !insertmacro CHECK_APP_RUNNING
!else
  \${ifNot} \${UAC_IsInnerInstance}
    !insertmacro CHECK_APP_RUNNING
  \${endif}
!endif`,
  `  ; CHECK_APP_RUNNING removed: app is killed in customInit (.onInit) before install runs
!else
  \${ifNot} \${UAC_IsInnerInstance}
    ; CHECK_APP_RUNNING removed: app is killed in customInit (.onInit) before install runs
  \${endif}
!endif`
);

// 2. uninstaller.nsh — replace CHECK_APP_RUNNING with a direct kill
patch(
  'uninstaller.nsh',
  `Function un.checkAppRunning
  !insertmacro CHECK_APP_RUNNING
FunctionEnd`,
  `Function un.checkAppRunning
  ; Kill the app before uninstalling instead of showing the "cannot close" dialog.
  nsExec::ExecToLog '"$SYSDIR\\taskkill.exe" /F /IM "\${PRODUCT_FILENAME}*.exe" /T'
  Pop $R0
  Sleep 3000
FunctionEnd`
);
