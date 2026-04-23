# Database Setup Scripts

## check-mysql.ps1

A PowerShell script to check if MySQL is running and attempt to start it automatically on Windows.

### Usage

```powershell
cd backend
.\scripts\check-mysql.ps1
```

Or from the backend directory:

```powershell
node scripts/check-mysql.ps1
```

### What it does

1. Checks if MySQL is listening on port 3306
2. If not running, attempts to find and start MySQL Windows service
3. Tests database connection using `test-db.js`
4. Provides helpful error messages and suggestions

### Manual MySQL Start Options

If the script can't start MySQL automatically:

1. **XAMPP/WAMP/MAMP**: Open control panel → Start MySQL
2. **Windows Services**: 
   - Press `Win + R`, type `services.msc`
   - Find MySQL service → Right-click → Start
3. **Command Line** (as Administrator):
   ```powershell
   net start MySQL80
   ```
   (Service name may vary: MySQL, MySQL80, etc.)
