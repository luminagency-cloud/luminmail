import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/server/auth";
import { logAppEvent } from "@/lib/server/error-log";
import { createIssueReport } from "@/lib/server/issue-report";

export async function POST(request: Request) {
  try {
    const { appUser } = await requireAppUser();
    const formData = await request.formData();

    const description = String(formData.get("description") || "").trim();
    const pageRoute = String(formData.get("pageRoute") || "/").trim();
    const accountIdValue = String(formData.get("accountId") || "").trim();
    const screenshotValue = formData.get("screenshot");

    if (!description) {
      return NextResponse.json({ error: "Issue description is required." }, { status: 400 });
    }

    const screenshot =
      screenshotValue instanceof File && screenshotValue.size > 0
        ? {
            name: screenshotValue.name,
            contentType: screenshotValue.type,
            size: screenshotValue.size,
            bytes: Buffer.from(await screenshotValue.arrayBuffer())
          }
        : null;

    const accountId = accountIdValue || null;
    const report = await createIssueReport({
      userId: appUser.id,
      authUserId: appUser.authUserId,
      accountId,
      reporterEmail: appUser.email ?? "unknown-user",
      pageRoute,
      description,
      screenshot
    });

    return NextResponse.json({
      ok: true,
      reportId: report.id
    });
  } catch (error) {
    await logAppEvent({
      scope: "issues.create",
      message: error instanceof Error ? error.message : "Unable to create issue report.",
      details: { error }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create issue report." },
      { status: 500 }
    );
  }
}
