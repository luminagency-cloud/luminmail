import { signOutAction } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/server/auth";

export async function AuthStatus() {
  const user = await getCurrentUser();

  if (!user) return null;

  return (
    <form action={signOutAction}>
      <button className="secondaryButton" type="submit">
        Sign out {user.email ?? ""}
      </button>
    </form>
  );
}
