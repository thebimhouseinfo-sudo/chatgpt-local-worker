#define AppName "GPTWorker"
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef RepoRoot
  #define RepoRoot ".."
#endif
#ifndef OutputDir
  #define OutputDir "..\\release\\out"
#endif

[Setup]
AppId={{7D6888FD-5B07-4B56-B5A4-7E23E4AE7A31}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Nam Trịnh
AppPublisherURL=https://github.com/thebimhouseinfo-sudo/chatgpt-local-worker
AppSupportURL=https://github.com/thebimhouseinfo-sudo/chatgpt-local-worker
AppUpdatesURL=https://github.com/thebimhouseinfo-sudo/chatgpt-local-worker/releases
DefaultDirName={localappdata}\\Programs\\GPTWorker
UsePreviousAppDir=yes
DisableDirPage=no
DefaultGroupName=GPTWorker
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir={#OutputDir}
OutputBaseFilename=GPTWorker-Setup-{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=GPTWorker
VersionInfoVersion={#AppVersion}
VersionInfoCompany=Nam Trịnh
VersionInfoDescription=GPTWorker installer
VersionInfoProductName=GPTWorker
VersionInfoProductVersion={#AppVersion}
LicenseFile={#RepoRoot}\\LICENSE
SetupLogging=yes
SetupIconFile={#RepoRoot}\\release\\staging\\GPTWorker\\gptworker.ico
UninstallDisplayIcon={app}\\gptworker.ico

[Files]
Source: "{#RepoRoot}\\release\\staging\\GPTWorker\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\\GPTWorker"; Filename: "{win}\\System32\\wscript.exe"; Parameters: """{app}\\gptworker-tray.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\\gptworker.ico"; Comment: "Launch GPTWorker tray"
Name: "{userdesktop}\\GPTWorker"; Filename: "{win}\\System32\\wscript.exe"; Parameters: """{app}\\gptworker-tray.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\\gptworker.ico"; Comment: "Launch GPTWorker tray"
Name: "{group}\\GPTWorker Setup Guide"; Filename: "{app}\\docs\\setup-guide\\index.html"
Name: "{group}\\Uninstall GPTWorker"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\\setup.bat"; Description: "Cấu hình và khởi động GPTWorker"; WorkingDir: "{app}"; Flags: postinstall waituntilterminated skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\\gptworker-tray.ps1"" -RemoveStartup"; Flags: runhidden skipifdoesntexist
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\\reset-runtime.ps1"""; Flags: runhidden skipifdoesntexist

[UninstallDelete]
Type: filesandordirs; Name: "{app}\\node_modules"
Type: filesandordirs; Name: "{app}\\bin"
Type: filesandordirs; Name: "{app}\\profiles"
