# GitHub 仓库协作者权限批量设置脚本
# 需要具有 admin:repo 或 admin:org 权限的 Personal Access Token

param(
    [Parameter(Mandatory=$true)]
    [string]$Token
)

$ErrorActionPreference = "Stop"

# 设置请求头
$headers = @{
    "Authorization" = "token $Token"
    "Accept" = "application/vnd.github.v3+json"
    "User-Agent" = "PowerShell-Script"
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GitHub 仓库协作者权限批量设置工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Token 权限
Write-Host "步骤 1: 检查 Token 权限..." -ForegroundColor Yellow
try {
    $userResponse = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers -Method GET
    Write-Host "✓ 认证成功，当前用户: $($userResponse.login)" -ForegroundColor Green
} catch {
    Write-Host "✗ 认证失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "请确保你的 Token 具有以下权限范围：" -ForegroundColor Yellow
    Write-Host "  - repo (完整仓库访问)" -ForegroundColor Yellow
    Write-Host "  - admin:repo 或 admin:org (管理员权限)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "创建新 Token 的步骤：" -ForegroundColor Yellow
    Write-Host "1. 访问 https://github.com/settings/tokens" -ForegroundColor Yellow
    Write-Host "2. 点击 'Generate new token (classic)'" -ForegroundColor Yellow
    Write-Host "3. 勾选 'repo' 和 'admin:repo' 或 'admin:org'" -ForegroundColor Yellow
    Write-Host "4. 生成并复制新 Token" -ForegroundColor Yellow
    exit 1
}

# 2. 获取所有仓库
Write-Host ""
Write-Host "步骤 2: 获取所有仓库..." -ForegroundColor Yellow
try {
    $repos = Invoke-RestMethod -Uri "https://api.github.com/user/repos?per_page=100&type=all" -Headers $headers -Method GET
    Write-Host "✓ 找到 $($repos.Count) 个仓库" -ForegroundColor Green
} catch {
    Write-Host "✗ 获取仓库列表失败: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. 遍历仓库并设置权限
Write-Host ""
Write-Host "步骤 3: 设置协作者权限..." -ForegroundColor Yellow
Write-Host ""

$totalUpdated = 0
$totalFailed = 0

foreach ($repo in $repos) {
    $repoName = $repo.full_name
    Write-Host "处理仓库: $repoName" -ForegroundColor Cyan
    
    # 获取仓库的协作者
    try {
        $collaborators = Invoke-RestMethod -Uri "https://api.github.com/repos/$repoName/collaborators" -Headers $headers -Method GET
        
        if ($collaborators.Count -eq 0) {
            Write-Host "  - 无协作者，跳过" -ForegroundColor Gray
            continue
        }
        
        Write-Host "  - 找到 $($collaborators.Count) 个协作者" -ForegroundColor White
        
        # 为每个协作者设置管理员权限
        foreach ($collab in $collaborators) {
            $username = $collab.login
            
            # 跳过仓库所有者
            if ($username -eq $userResponse.login) {
                Write-Host "    - 跳过所有者: $username" -ForegroundColor Gray
                continue
            }
            
            Write-Host "    - 设置管理员权限: $username" -ForegroundColor White -NoNewline
            
            try {
                $body = @{
                    permission = "admin"
                } | ConvertTo-Json
                
                $result = Invoke-RestMethod -Uri "https://api.github.com/repos/$repoName/collaborators/$username" -Method PUT -Headers $headers -Body $body -ContentType "application/json"
                
                Write-Host " ✓" -ForegroundColor Green
                $totalUpdated++
            } catch {
                Write-Host " ✗" -ForegroundColor Red
                Write-Host "      错误: $($_.Exception.Message)" -ForegroundColor Red
                $totalFailed++
            }
        }
    } catch {
        Write-Host "  - 获取协作者失败: $($_.Exception.Message)" -ForegroundColor Red
        $totalFailed++
    }
    
    Write-Host ""
}

# 4. 输出结果
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "执行完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "成功更新: $totalUpdated 个协作者" -ForegroundColor Green
if ($totalFailed -gt 0) {
    Write-Host "失败: $totalFailed 个" -ForegroundColor Red
}
Write-Host ""

if ($totalFailed -gt 0) {
    Write-Host "提示: 部分操作失败，可能是因为 Token 权限不足。" -ForegroundColor Yellow
    Write-Host "请确保 Token 包含 'admin:repo' 或 'admin:org' 权限范围。" -ForegroundColor Yellow
}
