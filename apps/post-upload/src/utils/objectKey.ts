export function sanitizeObjectName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

export function createObjectKey(prefix: string, fileName: string): string {
  const safeName = sanitizeObjectName(fileName) || 'file';
  return `${prefix}${Date.now()}_${safeName}`;
}
