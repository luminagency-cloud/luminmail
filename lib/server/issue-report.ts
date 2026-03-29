import { dbQuery, hasDatabaseUrl } from "@/lib/db/server";
import { sanitizeScreenshotFilename, validateScreenshotFile } from "@/lib/server/issue-report-utils";

type IssueReportInsertInput = {
  userId: string;
  authUserId: string | null;
  accountId: string | null;
  reporterEmail: string;
  pageRoute: string;
  description: string;
  screenshot?: {
    name: string;
    contentType: string;
    bytes: Buffer;
    size: number;
  } | null;
};

type IssueReportRow = {
  id: string;
  created_at: string;
};

export async function createIssueReport(input: IssueReportInsertInput) {
  if (!hasDatabaseUrl()) {
    throw new Error("Missing SUPABASE_DB_URL for issue reports.");
  }

  const screenshotValidationError = input.screenshot
    ? validateScreenshotFile({
        name: input.screenshot.name,
        type: input.screenshot.contentType,
        size: input.screenshot.size
      })
    : null;
  if (screenshotValidationError) {
    throw new Error(screenshotValidationError);
  }

  const insert = await dbQuery<IssueReportRow>(
    `
      insert into public.issue_reports (
        user_id, auth_user_id, account_id, reporter_email, page_route, description,
        screenshot_name, screenshot_content_type, screenshot_bytes, screenshot_size
      )
      values (
        $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::text,
        $7::text, $8::text, $9::bytea, $10::integer
      )
      returning id, created_at
    `,
    [
      input.userId,
      input.authUserId,
      input.accountId,
      input.reporterEmail,
      input.pageRoute,
      input.description.trim(),
      input.screenshot ? sanitizeScreenshotFilename(input.screenshot.name) : null,
      input.screenshot?.contentType ?? null,
      input.screenshot?.bytes ?? null,
      input.screenshot?.size ?? null
    ]
  );

  return insert.rows[0];
}
