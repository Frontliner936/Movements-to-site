const SOCIAL_POST_PREFIX = "\u001eGETMCHONGO_SOCIAL_POST_V1\u001e\n";

export function decodeSocialPostDescription(description: string | null) {
  const isSocialPost = description?.startsWith(SOCIAL_POST_PREFIX) ?? false;
  return {
    isSocialPost,
    description: isSocialPost ? description!.slice(SOCIAL_POST_PREFIX.length) : description,
  };
}

export function encodeSocialPostDescription(description: string): string {
  return `${SOCIAL_POST_PREFIX}${description}`;
}
