# MySQL Connection Checker and Starter Script for Windows
Write-Host "=== MySQL Connection Checker ===" -ForegroundColor Cyan
Write-Host ""

# Check if MySQL is running on port 3306
$port = 3306
$connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet

if ($connection) {
    Write-Host "✅ MySQL is running on port $port" -ForegroundColor Green
    Write-Host ""
    Write-Host "Testing database connection..." -ForegroundColor Yellow
    node test-db.js
} else {
    Write-Host "❌ MySQL is NOT running on port $port" -ForegroundColor Red
    Write-Host ""
    Write-Host "Attempting to find and start MySQL service..." -ForegroundColor Yellow
    Write-Host ""
    
    # Try to find MySQL service
    $mysqlServices = Get-Service | Where-Object { $_.Name -like "*mysql*" -or $_.DisplayName -like "*mysql*" }
    
    if ($mysqlServices.Count -eq 0) {
        Write-Host "⚠️  No MySQL service found." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Please start MySQL manually:" -ForegroundColor Cyan
        Write-Host "  1. If using XAMPP: Open XAMPP Control Panel and click 'Start' next to MySQL" -ForegroundColor White
        Write-Host "  2. If MySQL is installed: Open Services (Win+R, type 'services.msc') and start MySQL service" -ForegroundColor White
        Write-Host "  3. Check if MySQL is running on a different port (e.g., 3307)" -ForegroundColor White
    } else {
        Write-Host "Found MySQL service(s):" -ForegroundColor Cyan
        foreach ($service in $mysqlServices) {
            Write-Host "  - $($service.DisplayName) ($($service.Name)) - Status: $($service.Status)" -ForegroundColor White
        }
        Write-Host ""
        
        $stoppedServices = $mysqlServices | Where-Object { $_.Status -eq 'Stopped' }
        if ($stoppedServices.Count -gt 0) {
            Write-Host "Attempting to start MySQL service..." -ForegroundColor Yellow
            try {
                $stoppedServices | ForEach-Object {
                    Start-Service -Name $_.Name -ErrorAction Stop
                    Write-Host "✅ Started: $($_.DisplayName)" -ForegroundColor Green
                }
                Write-Host ""
                Write-Host "Waiting 3 seconds for MySQL to initialize..." -ForegroundColor Yellow
                Start-Sleep -Seconds 3
                Write-Host ""
                Write-Host "Testing database connection..." -ForegroundColor Yellow
                node test-db.js
            } catch {
                Write-Host "❌ Failed to start MySQL service: $_" -ForegroundColor Red
                Write-Host ""
                Write-Host "Please start MySQL manually:" -ForegroundColor Cyan
                Write-Host "  1. Open Services (Win+R, type 'services.msc')" -ForegroundColor White
                Write-Host "  2. Find MySQL service and right-click -> Start" -ForegroundColor White
            }
        } else {
            Write-Host "MySQL service is running but connection failed." -ForegroundColor Yellow
            Write-Host "Checking if MySQL is on a different port..." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Testing database connection..." -ForegroundColor Yellow
            node test-db.js
        }
    }
}

Write-Host ""
Write-Host "=== End of Check ===" -ForegroundColor Cyan
