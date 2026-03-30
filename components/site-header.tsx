import Link from "next/link";
import { signOutAction } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/server/auth";
import { APP_VERSION } from "@/lib/app-version";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="siteHeader">
      <div className="siteHeaderInner">
        <div className="siteBrand">
          <Link className="siteBrandLink" href={user ? "/inbox" : "/"}>
            <span className="eyebrow">LuminMail</span>
          </Link>
          <span className="versionBadge">v{APP_VERSION}</span>
        </div>

        <div className="siteHeaderActions">
          <nav aria-label="Primary" className="siteNav">
            <Link className="siteNavLink" href={user ? "/inbox" : "/"}>
              {user ? "Inbox" : "Home"}
            </Link>
            {user ? (
              <Link className="siteNavLink" href="/compose">
                Compose
              </Link>
            ) : null}
            {user ? (
              <Link className="siteNavLink" href="/accounts">
                Accounts
              </Link>
            ) : null}
            <Link className="siteNavLink" href="/about">
              About
            </Link>
          </nav>

          {user ? (
            <form action={signOutAction}>
              <button className="secondaryButton" type="submit">
                Sign out {user.email ?? ""}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </header>
  );
}
