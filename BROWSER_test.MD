LuminMail End-to-End Test Runbook
App URL: https://luminmail.luminagency.com
Last app version tested: v1.4.2

Run this in Claude for Chrome

Prerequisites
LuminMail App Account

Email: luminagency@gmail.com
Password: L!@Jhereg12a

Mail Accounts to Configure Inside the App
AccountEmailPasswordIMAP HostIMAP PortSMTP HostSMTP PortDokksltest@dokks.comKy3359ebfimap.dokks.com993smtp.dokks.com587Luminltest@luminagency.comKy3359ebfimap.luminagency.com993smtp.luminagency.com587

Step 1 — Sign Up (First Run Only)

Go to https://luminmail.luminagency.com
Under New Account / Sign up, enter email and password, click Sign up
You should be signed in immediately

Step 2 — Sign In (Subsequent Runs)

Go to https://luminmail.luminagency.com
Under Existing Account / Sign in, enter email and password, click Sign in

Step 3 — Password Reset (If Needed)

Go to https://luminmail.luminagency.com
Use the Password reset form on the home page
Open the newest reset link email, or use the server-logged reset URL in development
Set the new password on `/reset-password`

Step 4 — Add Mail Accounts

From the inbox, click Manage accounts
For each account in the table above, fill in: Account name, Email address, IMAP host, IMAP port, SMTP host, SMTP port, Password
Click Create account
Confirm it appears under Existing accounts before adding the next one

Step 5 — Send & Reply Test (4 Messages)
StepActive AccountAction1Dokks (ltest@dokks.com)Click New email, set To: ltest@luminagency.com, write a subject and message, click Send email2Lumin (ltest@luminagency.com)Switch account via dropdown, wait for email to arrive, type a reply in the Reply box, click Send Reply3Dokks (ltest@dokks.com)Switch back, wait for reply to arrive, type a reply, click Send Reply4Lumin (ltest@luminagency.com)Switch back, wait for reply to arrive, type a final reply, click Send Reply
Expected result: Each inbox shows all messages in the thread; both accounts send and receive correctly.

Notes

The inbox polls every 15 minutes by default, but messages arrive immediately when the inbox is open
Account switching is done via the Switch account dropdown on the inbox page
The reply box is inline on the message view; no separate reply page is needed
