import { test, expect } from '@playwright/test';

test('Faculty Login and Dashboard Navigation', async ({ page }) => {
    // 1. Go to Login Page
    await page.goto('/login');

    // 2. Fill Credentials (using IDs from LoginForm)
    await page.fill('#email', 'prof@university.edu');
    await page.fill('#password', 'password123');

    // 3. Click Sign In (using text selector)
    await page.click('button:has-text("Sign in")');

    // 4. Expect redirection to Faculty Dashboard
    await expect(page).toHaveURL(/\/faculty/);

    // 5. Verify Dashboard Content
    await expect(page.getByText('Faculty Dashboard')).toBeVisible();
    await expect(page.getByText('Welcome, Professor')).toBeVisible();
});
