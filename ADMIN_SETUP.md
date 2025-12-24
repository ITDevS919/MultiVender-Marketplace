# Admin Account Setup Guide

This guide explains how to create an admin account for the Marketplace Hub application.

## Method 1: Using the Web Interface (Recommended for First Admin)

1. Navigate to the admin login page: `http://localhost:5173/admin`
2. Click the "First time? Create admin account" button at the bottom of the login form
3. Fill in the form with:
   - Username
   - Email
   - Password (minimum 6 characters)
4. Click "Create Admin"
5. Once created, you can log in with the credentials you just created

**Note:** This method only works if no admin user exists yet. If an admin already exists, use Method 2.

## Method 2: Using the Command Line Script

If you already have an admin account or prefer using the command line:

1. Navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Run the create-admin script:
   ```bash
   npm run create-admin <username> <email> <password>
   ```

   Example:
   ```bash
   npm run create-admin admin admin@example.com admin123
   ```

3. The script will:
   - Check if an admin already exists
   - Create a new admin user with the provided credentials
   - Display the created admin details

4. Log in at `http://localhost:5173/admin` with your new credentials

## Method 3: Direct Database Access (Advanced)

If you have direct database access, you can create an admin user directly:

```sql
-- Hash your password first (use bcrypt with 10 rounds)
-- Then insert:
INSERT INTO users (username, email, password, role) 
VALUES ('admin', 'admin@example.com', '<hashed_password>', 'admin');
```

**Note:** Make sure to hash the password using bcrypt before inserting it into the database.

## Security Notes

- The web interface setup endpoint (`/api/admin/setup`) only works if no admin exists
- After the first admin is created, you must use the command-line script or database to create additional admins
- Always use strong passwords for admin accounts
- Keep admin credentials secure and never commit them to version control

## Troubleshooting

### "Admin user already exists" error
- Use Method 2 (command line script) instead
- Or modify the script to allow multiple admins

### "Username or email already exists" error
- Choose a different username or email
- Or use an existing account if you have one

### Can't connect to database
- Make sure your database is running
- Check your `.env` file for correct database credentials
- Verify the database connection in `server/src/db/connection.ts`

