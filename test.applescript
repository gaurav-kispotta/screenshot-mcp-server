osascript -e "tell application \"System Events\"
        set allWindows to {}
        set allProcesses to processes whose background only is false
        repeat with proc in allProcesses
          set procName to name of proc
          set procID to unix id of proc
          set windowList to windows of proc
          repeat with win in windowList
            set winName to name of win
            set winPos to position of win
            set winSize to size of win
            set end of allWindows to {procName:procName, procID:procID, name:winName, position:winPos, size:winSize}
          end repeat
        end repeat
        return allWindows
      end tell" -ss