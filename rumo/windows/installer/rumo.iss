; Instalador do Rumo para Windows (Inno Setup 6). Compilado pelo GitHub Actions:
;   iscc /DAppVersion=1.0.0 /DSourceDir=<pasta Release do flutter> /DOutputDir=<saída> rumo.iss
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{6B7E2C1A-4F3D-4A8E-9C51-2D7F0E8B9A31}
AppName=Rumo
AppVersion={#AppVersion}
AppPublisher=Rumo
DefaultDirName={autopf}\Rumo
DefaultGroupName=Rumo
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir={#OutputDir}
OutputBaseFilename=Rumo-Setup-{#AppVersion}
SetupIconFile=..\runner\resources\app_icon.ico
UninstallDisplayIcon={app}\Rumo.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Rumo"; Filename: "{app}\Rumo.exe"
Name: "{autodesktop}\Rumo"; Filename: "{app}\Rumo.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Rumo.exe"; Description: "{cm:LaunchProgram,Rumo}"; Flags: nowait postinstall skipifsilent
