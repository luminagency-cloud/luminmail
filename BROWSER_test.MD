// LuminMail end-to-end test flow script
// this is for puppeteer, need to see if Claud in Chrome can do it
# Test idea
I want you to create an account.
Log in to it
create 2 email accounts once in.

send 3 or 4 emails between these accounts and reply from within the app.
Switch to acct 1, send email to other; switch to Acct 3, reply to email, repeat.

#test setup
app is at luminmail.luminagency.com

##login to app account
luminagency@gmail.com
pwd: L!@Jhereg12a

#test demo code
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

#test data

## Accounts to create and test with
mail account 1: ltest@dokks.com
mail account 2: ltest@luminagency.com

username is the email address
password for both: Ky3359ebf

###Server info
imap.[domain].com port 993
smtp.[domain].com port 587

