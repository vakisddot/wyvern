export function formatRoleName(slug: string): string {
  return slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}
