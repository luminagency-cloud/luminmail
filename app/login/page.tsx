import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  if (params.error) query.set("error", params.error);
  if (params.message) query.set("message", params.message);
  if (params.next) query.set("next", params.next);

  redirect(query.size > 0 ? `/?${query.toString()}` : "/");
}
