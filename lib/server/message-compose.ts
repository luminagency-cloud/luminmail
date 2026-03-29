export function applySignature(bodyText: string, signature: string) {
  const trimmedBody = bodyText.trim();
  const trimmedSignature = signature.trim();

  if (!trimmedSignature) {
    return trimmedBody;
  }

  return `${trimmedBody}\n\n${trimmedSignature}`;
}
