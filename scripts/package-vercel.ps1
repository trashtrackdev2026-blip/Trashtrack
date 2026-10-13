$ErrorActionPreference = 'Stop'
$taskProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskWorkspaceRoot = [IO.Path]::GetFullPath((Join-Path $taskProjectRoot '..'))
$taskOutputFolder = Join-Path $taskWorkspaceRoot 'output'
$taskArchivePath = Join-Path $taskOutputFolder 'TrashTrack-admin-vercel-ready.zip'
if (-not $taskArchivePath.StartsWith($taskWorkspaceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Archive target must stay in the TrashTrack workspace.'
}
$taskRootFiles = @('.env.example', '.gitignore', '.vercelignore', 'vercel.json', 'package.json', 'package-lock.json',
    'next.config.ts', 'tsconfig.json', 'eslint.config.mjs', 'postcss.config.mjs', 'components.json', 'README.md',
    'VERCEL-LAUNCH.md', 'ADMIN-SECURITY.md', 'PERFORMANCE.md', 'AGENTS.md')
$taskFolders = @('src', 'public', 'assets', 'data', 'scripts', 'tests')
$taskFiles = @()
foreach ($taskName in $taskRootFiles) {
    $taskFile = Join-Path $taskProjectRoot $taskName
    if (Test-Path -LiteralPath $taskFile -PathType Leaf) { $taskFiles += Get-Item -LiteralPath $taskFile }
}
foreach ($taskFolder in $taskFolders) {
    $taskFiles += Get-ChildItem -LiteralPath (Join-Path $taskProjectRoot $taskFolder) -File -Recurse
}
$taskFiles = $taskFiles | Where-Object {
    $_.Name -notmatch '(?i)firebase-adminsdk|service-account|\.pem$|\.log$|\.tsbuildinfo$' -and
    ($_.Name -notlike '.env*' -or $_.Name -eq '.env.example') -and
    $_.FullName -notmatch '(?i)[\\/](secrets|deployment-private|node_modules|\.next|\.vercel)[\\/]'
}
New-Item -ItemType Directory -Path $taskOutputFolder -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskArchiveStream = [IO.File]::Open($taskArchivePath, [IO.FileMode]::Create)
$taskArchive = New-Object IO.Compression.ZipArchive($taskArchiveStream, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($taskFile in $taskFiles) {
        $taskRelativePath = $taskFile.FullName.Substring($taskProjectRoot.Length + 1).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive, $taskFile.FullName,
            $taskRelativePath, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $taskArchive.Dispose(); $taskArchiveStream.Dispose() }
Write-Output ('Prepared source archive: ' + $taskArchivePath)
Write-Output ('Included ' + $taskFiles.Count + ' source/config/asset files. Private environments and credentials are excluded.')
