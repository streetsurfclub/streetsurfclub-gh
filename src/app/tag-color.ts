/** Number of Salubra wall-tone slots a tag pill can land in. */
const TAG_COLOR_COUNT = 4;

/**
 * Stable color slot per tag: djb2 hash of the tag string mod slot count.
 * Same tag → same pill color on every page (list + post detail).
 */
export function tagColorClass(tag: string): string {
  let h = 5381;
  for (let i = 0; i < tag.length; i++) {
    h = ((h << 5) + h + tag.charCodeAt(i)) | 0;
  }
  return `tag-c${Math.abs(h) % TAG_COLOR_COUNT}`;
}
