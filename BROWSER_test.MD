// LuminMail end-to-end test flow script

import { test, expect } from '@playwright/test';

 test.describe('LuminMail End-to-End Test Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the LuminMail webpage
        await page.goto('https://luminmail.com');
    });

    test('User should be able to register', async ({ page }) => {
        await page.click('text=Sign Up');
        await page.fill('#email', 'user@example.com');
        await page.fill('#password', 'securePassword123');
        await page.click('button[type="submit"]');

        const successMessage = await page.locator('text=Registration successful');
        await expect(successMessage).toBeVisible();
    });

    test('User should be able to log in', async ({ page }) => {
        await page.click('text=Log In');
        await page.fill('#email', 'user@example.com');
        await page.fill('#password', 'securePassword123');
        await page.click('button[type="submit"]');

        const dashboard = await page.locator('text=Welcome to LuminMail');
        await expect(dashboard).toBeVisible();
    });

    test('User should be able to send an email', async ({ page }) => {
        await page.click('text=Compose');
        await page.fill('#to', 'recipient@example.com');
        await page.fill('#subject', 'Test Email');
        await page.fill('#body', 'This is a test email.');
        await page.click('button[type="submit"]');

        const emailSentMessage = await page.locator('text=Email sent successfully');
        await expect(emailSentMessage).toBeVisible();
    });
});