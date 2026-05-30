; Custom NSIS installer script for IEOM
; Handles protocol registration in Windows Registry

!macro customInstall
  ; Register ieom:// protocol handler
  DetailPrint "Registering ieom:// protocol handler..."
  WriteRegStr HKCU "Software\Classes\ieom" "" "URL:IEOM Protocol"
  WriteRegStr HKCU "Software\Classes\ieom" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\ieom\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\ieom\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  ; Unregister ieom:// protocol handler
  DetailPrint "Unregistering ieom:// protocol handler..."
  DeleteRegKey HKCU "Software\Classes\ieom"
!macroend
