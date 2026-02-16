import { test, expect } from '@playwright/test';

test('Student Login and Dashboard Navigation', async ({ page }) => {
    // 1. Go to Login Page
    await page.goto('/login');

    // 2. Fill Credentials (using IDs from LoginForm)
    await page.fill('#email', 'student@university.edu');
    await page.fill('#password', 'student123');

    // 3. Click Sign In (using text selector)
    await page.click('button:has-text("Sign in")');

    // 4. Expect redirection to Student Dashboard
    await expect(page).toHaveURL(/\/student/);

    // 5. Verify Dashboard Content
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Start New Assignment')).toBeVisible();

    // 6. Navigate to Workspace
    await page.getByText('Start New Assignment').click();
    await expect(page).toHaveURL(/\/student\/workspace/);
});
